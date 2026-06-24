import { describe, it, expect, beforeEach } from 'vitest';
import {
  onRotateHandlePointerDown,
  onSelectPointerMove,
  onSelectPointerUp,
} from '../select-tool';
import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import type { Element } from '../../../types/shared';

function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'el-1',
    type: 'rectangle',
    x: 50,
    y: 50,
    width: 100,
    height: 100,
    angle: 0,
    zIndex: 1,
    props: {
      strokeColor: '#000',
      fillColor: '#fff',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
    },
    version: 1,
    versionNonce: 123,
    updatedAt: Date.now(),
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
    ...overrides,
  };
}

beforeEach(() => {
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().setSelectedIds([]);
  useInteractionStore.getState().setDraggingId(null);
  useInteractionStore.getState().setDragStart(null);
  useInteractionStore.getState().setDraftElement(null);
  useInteractionStore.getState().setIsRotating(false);
});

describe('onRotateHandlePointerDown', () => {
  // @covers AC-1
  it('sets isRotating=true, draggingId, and dragStart on selected element', () => {
    const el = makeElement({ id: 'rot-1' });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);

    onRotateHandlePointerDown({ x: 100, y: 26 });

    const state = useInteractionStore.getState();
    expect(state.isRotating).toBe(true);
    expect(state.draggingId).toBe('rot-1');
    expect(state.dragStart).toEqual({ x: 100, y: 26 });
  });

  it('is a no-op when nothing is selected', () => {
    useInteractionStore.getState().setSelectedIds([]);

    onRotateHandlePointerDown({ x: 100, y: 26 });

    expect(useInteractionStore.getState().isRotating).toBe(false);
    expect(useInteractionStore.getState().draggingId).toBeNull();
  });
});

describe('onSelectPointerMove — rotate branch', () => {
  // @covers AC-1, AC-2
  it('with isRotating=true: sets draftElement.angle based on pointer angle from center', () => {
    // Element centered at (100, 100)
    const el = makeElement({ id: 'rot-2', x: 50, y: 50, width: 100, height: 100 });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);
    useInteractionStore.getState().setDraggingId(el.id);
    useInteractionStore.getState().setDragStart({ x: 100, y: 26 }); // above center
    useInteractionStore.getState().setIsRotating(true);

    // Drag pointer to 3 o'clock (right of center) → angle = π/2
    onSelectPointerMove({ x: 200, y: 100 });

    const draft = useInteractionStore.getState().draftElement;
    expect(draft).not.toBeNull();
    // @covers AC-3
    expect(draft?.angle).toBeCloseTo(Math.PI / 2, 2);
  });

  it("with isRotating=true: dragging to 6 o'clock produces angle ≈ π", () => {
    const el = makeElement({ id: 'rot-3', x: 50, y: 50, width: 100, height: 100 });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setDraggingId(el.id);
    useInteractionStore.getState().setDragStart({ x: 100, y: 26 });
    useInteractionStore.getState().setIsRotating(true);

    onSelectPointerMove({ x: 100, y: 200 });

    const draft = useInteractionStore.getState().draftElement;
    expect(Math.abs(draft?.angle ?? 0)).toBeCloseTo(Math.PI, 2);
  });

  it('with isRotating=false: normal move branch runs instead (draftElement angle unchanged)', () => {
    const el = makeElement({ id: 'rot-4', x: 50, y: 50, width: 100, height: 100 });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setDraggingId(el.id);
    useInteractionStore.getState().setDragStart({ x: 100, y: 100 });
    useInteractionStore.getState().setIsRotating(false);
    useInteractionStore.getState().setResizeHandle(null);
    useInteractionStore.getState().setResizeSession(null);

    onSelectPointerMove({ x: 110, y: 110 });

    const draft = useInteractionStore.getState().draftElement;
    // Normal move: x and y shifted by 10, angle NOT set to π/2
    expect(draft?.angle).toBe(0);
    expect(draft?.x).toBe(60);
  });
});

describe('onSelectPointerUp — rotate commit', () => {
  // @covers AC-2
  it('with isRotating=true: commits angle via patchElement and clears rotate state', () => {
    const el = makeElement({ id: 'rot-5', x: 50, y: 50, width: 100, height: 100, version: 1 });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setDraggingId(el.id);
    useInteractionStore.getState().setDragStart({ x: 100, y: 26 });
    useInteractionStore.getState().setIsRotating(true);
    useInteractionStore.getState().setDraftElement({ ...el, angle: Math.PI / 2 });

    onSelectPointerUp({ x: 200, y: 100 });

    // Angle committed to elements store
    const updated = useElementsStore.getState().elements.find((e) => e.id === 'rot-5')!;
    expect(updated.angle).toBeCloseTo(Math.PI / 2, 2);
    expect(updated.version).toBe(2); // version incremented by pipeline

    // Rotate state cleared
    expect(useInteractionStore.getState().isRotating).toBe(false);
    expect(useInteractionStore.getState().draggingId).toBeNull();
    expect(useInteractionStore.getState().draftElement).toBeNull();
  });

  // @covers AC-4
  it('rotate commit goes through patchElement pipeline (version increments)', () => {
    const el = makeElement({ id: 'rot-6', version: 1 });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setDraggingId(el.id);
    useInteractionStore.getState().setDragStart({ x: 100, y: 26 });
    useInteractionStore.getState().setIsRotating(true);
    useInteractionStore.getState().setDraftElement({ ...el, angle: 1.0 });

    onSelectPointerUp({ x: 200, y: 100 });

    const updated = useElementsStore.getState().elements.find((e) => e.id === 'rot-6')!;
    // Version must be incremented (proves pipeline ran, not direct store write)
    expect(updated.version).toBeGreaterThan(1);
  });
});
