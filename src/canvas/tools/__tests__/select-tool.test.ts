import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  onSelectPointerDown,
  onSelectPointerMove,
  onSelectPointerUp,
  onSelectHandlePointerDown,
  onSelectKeyDown,
  computeResize,
  getFlippedHandle,
  resizeBoundsFromAnchorAndPointer,
} from '../select-tool';
import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import type { Element } from '../../../types/shared';

function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'el-1',
    type: 'rectangle',
    x: 10,
    y: 10,
    width: 100,
    height: 50,
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
});

describe('onSelectPointerDown — User Story 1: click to select', () => {
  // @covers AC-1
  it('clicking inside shape bbox sets selectedIds to that shape id', () => {
    const el = makeElement({ id: 'rect-1', x: 10, y: 10, width: 100, height: 50 });
    useElementsStore.getState().addElement(el);

    onSelectPointerDown({ x: 60, y: 30 });

    expect(useInteractionStore.getState().selectedIds).toContain('rect-1');
  });

  // @covers AC-2
  it('overlapping shapes: higher zIndex shape is selected', () => {
    const low = makeElement({ id: 'low-z', x: 0, y: 0, width: 100, height: 100, zIndex: 1 });
    const high = makeElement({ id: 'high-z', x: 0, y: 0, width: 100, height: 100, zIndex: 2 });
    useElementsStore.getState().setElements([low, high]);

    onSelectPointerDown({ x: 50, y: 50 });

    expect(useInteractionStore.getState().selectedIds).toEqual(['high-z']);
  });

  // @covers AC-3
  it('clicking shape B while A is selected replaces selection with B only', () => {
    const a = makeElement({ id: 'shape-a', x: 0, y: 0, width: 50, height: 50, zIndex: 1 });
    const b = makeElement({ id: 'shape-b', x: 100, y: 0, width: 50, height: 50, zIndex: 1 });
    useElementsStore.getState().setElements([a, b]);
    useInteractionStore.getState().setSelectedIds(['shape-a']);

    onSelectPointerDown({ x: 125, y: 25 });

    expect(useInteractionStore.getState().selectedIds).toEqual(['shape-b']);
  });
});

describe('onSelectPointerDown — User Story 2: deselect', () => {
  // @covers AC-4
  it('clicking empty area when shape is selected clears selectedIds', () => {
    const el = makeElement({ id: 'rect-1', x: 0, y: 0, width: 50, height: 50 });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds(['rect-1']);

    onSelectPointerDown({ x: 200, y: 200 });

    expect(useInteractionStore.getState().selectedIds).toEqual([]);
  });

  // @covers AC-5
  it('clicking empty area when nothing is selected causes no error', () => {
    useElementsStore.getState().setElements([]);

    expect(() => onSelectPointerDown({ x: 50, y: 50 })).not.toThrow();
    expect(useInteractionStore.getState().selectedIds).toEqual([]);
  });
});

describe('onSelectPointerDown — AC-6: selection state isolation', () => {
  // @covers AC-6
  it('never mutates elementsStore on click', () => {
    const el = makeElement({ id: 'rect-1', x: 0, y: 0, width: 100, height: 100 });
    useElementsStore.getState().setElements([el]);
    const elementsBefore = useElementsStore.getState().elements;

    onSelectPointerDown({ x: 50, y: 50 });

    expect(useElementsStore.getState().elements).toBe(elementsBefore);
  });

  // @covers AC-6
  it('never calls localStorage.setItem during selection', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const el = makeElement({ id: 'rect-1', x: 0, y: 0, width: 100, height: 100 });
    useElementsStore.getState().setElements([el]);

    onSelectPointerDown({ x: 50, y: 50 });

    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });
});

describe('onSelectPointerDown — edge cases', () => {
  it('empty elements store: no error, selectedIds stays []', () => {
    useElementsStore.getState().setElements([]);

    expect(() => onSelectPointerDown({ x: 0, y: 0 })).not.toThrow();
    expect(useInteractionStore.getState().selectedIds).toEqual([]);
  });

  it('isDeleted elements are ignored even if click hits their bbox', () => {
    const deleted = makeElement({
      id: 'deleted-el',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      isDeleted: true,
    });
    useElementsStore.getState().setElements([deleted]);

    onSelectPointerDown({ x: 50, y: 50 });

    expect(useInteractionStore.getState().selectedIds).toEqual([]);
  });
});

// ─── P1A-03: Move / Resize / Delete ──────────────────────────────────────────

function resetDragState() {
  useInteractionStore.getState().setDraggingId(null);
  useInteractionStore.getState().setDragStart(null);
  useInteractionStore.getState().setResizeHandle(null);
  useInteractionStore.getState().setResizeSession(null);
  useInteractionStore.getState().setDraftElement(null);
}

beforeEach(() => {
  resetDragState();
});

describe('P1A-03 — Move', () => {
  // @covers AC-1 (002-move-resize-delete)
  it('pointerMove sets draftElement.x/y to committed position + delta', () => {
    const el = makeElement({ id: 'mv-1', x: 10, y: 10 });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setDraggingId(el.id);
    useInteractionStore.getState().setDragStart({ x: 50, y: 50 });
    useInteractionStore.getState().setResizeHandle(null);

    onSelectPointerMove({ x: 80, y: 70 });

    const draft = useInteractionStore.getState().draftElement;
    expect(draft?.x).toBe(40); // 10 + (80-50)
    expect(draft?.y).toBe(30); // 10 + (70-50)
  });

  // @covers AC-2 (002-move-resize-delete)
  it('pointerUp commits x/y to the element store with incremented version', () => {
    const el = makeElement({ id: 'mv-2', x: 10, y: 10, version: 1 });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setDraggingId(el.id);
    useInteractionStore.getState().setDragStart({ x: 0, y: 0 });
    useInteractionStore.getState().setDraftElement({ ...el, x: 60, y: 40 });
    useInteractionStore.getState().setResizeHandle(null);

    onSelectPointerUp({ x: 60, y: 40 });

    const updated = useElementsStore.getState().elements.find((e) => e.id === 'mv-2')!;
    expect(updated.x).toBe(60);
    expect(updated.y).toBe(40);
    expect(updated.version).toBe(2);
  });

  // @covers AC-3 (002-move-resize-delete)
  it('pointerDown on empty canvas sets draggingId to null', () => {
    useElementsStore.getState().setElements([]);
    useInteractionStore.getState().setSelectedIds([]);

    onSelectPointerDown({ x: 999, y: 999 });

    expect(useInteractionStore.getState().draggingId).toBeNull();
    expect(useInteractionStore.getState().dragStart).toBeNull();
  });

  it('pointerUp without prior move (no draftElement) does not patch the store', () => {
    const el = makeElement({ id: 'mv-3', x: 10, y: 10 });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setDraggingId(el.id);
    useInteractionStore.getState().setDragStart({ x: 10, y: 10 });
    // No draftElement set — simulating click with no drag

    onSelectPointerUp({ x: 10, y: 10 });

    const stored = useElementsStore.getState().elements.find((e) => e.id === 'mv-3')!;
    expect(stored.x).toBe(10); // unchanged
    expect(stored.version).toBe(1); // not incremented
  });

  // @covers AC-13 (002-move-resize-delete)
  it('moves line points together with the bounding box', () => {
    const el = makeElement({
      id: 'line-move',
      type: 'line',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      props: {
        strokeColor: '#000',
        fillColor: 'none',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
        points: [[10, 20], [110, 70]],
      },
    });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setDraggingId(el.id);
    useInteractionStore.getState().setDragStart({ x: 60, y: 45 });
    useInteractionStore.getState().setResizeHandle(null);

    onSelectPointerMove({ x: 90, y: 65 });

    expect(useInteractionStore.getState().draftElement?.props.points).toEqual([
      [40, 40],
      [140, 90],
    ]);

    onSelectPointerUp({ x: 90, y: 65 });

    const updated = useElementsStore.getState().elements.find((e) => e.id === el.id)!;
    expect(updated).toMatchObject({ x: 40, y: 40 });
    expect(updated.props.points).toEqual([[40, 40], [140, 90]]);
  });
});

describe('P1A-03 — computeResize helper', () => {
  const el = makeElement({ x: 10, y: 10, width: 100, height: 50 });

  // @covers AC-4 (002-move-resize-delete)
  it('se handle: width/height grow, x/y unchanged', () => {
    const result = computeResize(el, 'se', { x: 140, y: 80 });
    expect(result.width).toBe(130); // 140 - 10
    expect(result.height).toBe(70); // 80 - 10
    expect(result.x).toBe(10);
    expect(result.y).toBe(10);
  });

  // @covers AC-5 (002-move-resize-delete)
  it('nw handle: x and y shift, width and height adjust inversely', () => {
    const result = computeResize(el, 'nw', { x: 40, y: 30 });
    expect(result.x).toBe(40);
    expect(result.y).toBe(30);
    expect(result.width).toBe(70); // 110 - 40
    expect(result.height).toBe(30); // 60 - 30
  });

  // @covers AC-6 (002-move-resize-delete)
  it('n handle: y shifts, height adjusts; x and width unchanged', () => {
    const result = computeResize(el, 'n', { x: 60, y: 30 });
    expect(result.y).toBe(30);
    expect(result.height).toBe(30); // 60 - 30
    expect(result.x).toBe(10);
    expect(result.width).toBe(100);
  });

  // @covers AC-7 (002-move-resize-delete)
  it('keeps a tiny positive size exactly at the anchor', () => {
    const result = computeResize(el, 'se', { x: 10, y: 10 });
    expect(result).toMatchObject({ x: 10, y: 10, width: 1, height: 1 });
  });
});

describe('P1A-03 — Resize with flip', () => {
  const bounds = { x: 10, y: 10, width: 100, height: 50 };
  const cornerCases = [
    {
      handle: 'nw' as const,
      anchor: { x: 110, y: 60 },
      horizontal: { pointer: { x: 130, y: 10 }, activeHandle: 'ne' as const },
      vertical: { pointer: { x: 10, y: 80 }, activeHandle: 'sw' as const },
      both: { pointer: { x: 130, y: 80 }, activeHandle: 'se' as const },
    },
    {
      handle: 'ne' as const,
      anchor: { x: 10, y: 60 },
      horizontal: { pointer: { x: -10, y: 10 }, activeHandle: 'nw' as const },
      vertical: { pointer: { x: 110, y: 80 }, activeHandle: 'se' as const },
      both: { pointer: { x: -10, y: 80 }, activeHandle: 'sw' as const },
    },
    {
      handle: 'sw' as const,
      anchor: { x: 110, y: 10 },
      horizontal: { pointer: { x: 130, y: 60 }, activeHandle: 'se' as const },
      vertical: { pointer: { x: 10, y: -10 }, activeHandle: 'nw' as const },
      both: { pointer: { x: 130, y: -10 }, activeHandle: 'ne' as const },
    },
    {
      handle: 'se' as const,
      anchor: { x: 10, y: 10 },
      horizontal: { pointer: { x: -10, y: 60 }, activeHandle: 'sw' as const },
      vertical: { pointer: { x: 110, y: -10 }, activeHandle: 'ne' as const },
      both: { pointer: { x: -10, y: -10 }, activeHandle: 'nw' as const },
    },
  ];

  for (const cornerCase of cornerCases) {
    for (const axisCase of ['horizontal', 'vertical', 'both'] as const) {
      const { pointer, activeHandle } = cornerCase[axisCase];

      // @covers AC-15, AC-16, AC-17 (002-move-resize-delete)
      it(`${cornerCase.handle} crossing ${axisCase} axis flips to ${activeHandle}`, () => {
        const result = resizeBoundsFromAnchorAndPointer(
          {
            originalBounds: bounds,
            originalHandle: cornerCase.handle,
            anchor: cornerCase.anchor,
          },
          pointer,
        );

        expect(result).toMatchObject({
          x: Math.min(cornerCase.anchor.x, pointer.x),
          y: Math.min(cornerCase.anchor.y, pointer.y),
          width: Math.abs(pointer.x - cornerCase.anchor.x),
          height: Math.abs(pointer.y - cornerCase.anchor.y),
          activeHandle,
        });
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
      });
    }
  }

  it('maps edge handles when they cross their fixed anchor', () => {
    expect(computeResize(makeElement(bounds), 'e', { x: 0, y: 35 })).toMatchObject({
      x: 0,
      y: 10,
      width: 10,
      height: 50,
      activeHandle: 'w',
    });
    expect(computeResize(makeElement(bounds), 'n', { x: 60, y: 80 })).toMatchObject({
      x: 10,
      y: 60,
      width: 100,
      height: 20,
      activeHandle: 's',
    });
  });

  it('maps original handles through horizontal and vertical flips', () => {
    expect(getFlippedHandle('se', true, false)).toBe('sw');
    expect(getFlippedHandle('se', false, true)).toBe('ne');
    expect(getFlippedHandle('se', true, true)).toBe('nw');
  });

  it('keeps the original anchor stable when crossing and crossing back', () => {
    const el = makeElement({ id: 'stable-anchor' });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);
    onSelectHandlePointerDown('se', { x: 110, y: 60 });

    onSelectPointerMove({ x: -20, y: -30 });
    expect(useInteractionStore.getState().resizeHandle).toBe('nw');
    expect(useInteractionStore.getState().resizeSession?.anchor).toEqual({ x: 10, y: 10 });

    onSelectPointerMove({ x: 140, y: 90 });
    expect(useInteractionStore.getState().draftElement).toMatchObject({
      x: 10,
      y: 10,
      width: 130,
      height: 80,
    });
    expect(useInteractionStore.getState().resizeHandle).toBe('se');
    expect(useInteractionStore.getState().resizeSession?.anchor).toEqual({ x: 10, y: 10 });
  });
});

describe('P1A-03 — Resize via onSelectPointerMove', () => {
  // @covers AC-8 (002-move-resize-delete)
  it('pointerUp after resize commits final dimensions with incremented version', () => {
    const el = makeElement({ id: 're-1', x: 10, y: 10, width: 100, height: 50, version: 1 });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);
    onSelectHandlePointerDown('se', { x: 110, y: 60 });
    useInteractionStore.getState().setDraftElement({ ...el, width: 130, height: 70 });

    onSelectPointerUp({ x: 140, y: 80 });

    const updated = useElementsStore.getState().elements.find((e) => e.id === 're-1')!;
    expect(updated.width).toBe(130);
    expect(updated.height).toBe(70);
    expect(updated.version).toBe(2);
  });

  // @covers AC-14 (002-move-resize-delete)
  it('resizes line points together with the bounding box', () => {
    const el = makeElement({
      id: 'line-resize',
      type: 'line',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      props: {
        strokeColor: '#000',
        fillColor: 'none',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
        points: [[110, 20], [10, 70]],
      },
    });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);
    onSelectHandlePointerDown('se', { x: 110, y: 70 });

    onSelectPointerMove({ x: 160, y: 100 });

    const draft = useInteractionStore.getState().draftElement;
    expect(draft).toMatchObject({ x: 10, y: 20, width: 150, height: 80 });
    expect(draft?.props.points).toEqual([[160, 20], [10, 100]]);

    onSelectPointerUp({ x: 160, y: 100 });

    const updated = useElementsStore.getState().elements.find((e) => e.id === el.id)!;
    expect(updated).toMatchObject({ x: 10, y: 20, width: 150, height: 80 });
    expect(updated.props.points).toEqual([[160, 20], [10, 100]]);
  });

  it('can resize a horizontal line into a diagonal line', () => {
    const el = makeElement({
      id: 'horizontal-line-resize',
      type: 'line',
      x: 10,
      y: 20,
      width: 100,
      height: 0,
      props: {
        strokeColor: '#000',
        fillColor: 'none',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
        points: [[10, 20], [110, 20]],
      },
    });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);
    onSelectHandlePointerDown('se', { x: 110, y: 20 });

    onSelectPointerMove({ x: 140, y: 60 });

    expect(useInteractionStore.getState().draftElement?.props.points).toEqual([
      [10, 20],
      [140, 60],
    ]);
  });

  // @covers AC-18 (002-move-resize-delete)
  it('mirrors line point geometry when resized across both axes', () => {
    const el = makeElement({
      id: 'line-flip',
      type: 'line',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      props: {
        strokeColor: '#000',
        fillColor: 'none',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
        points: [[10, 20], [110, 70]],
      },
    });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);
    onSelectHandlePointerDown('se', { x: 110, y: 70 });

    onSelectPointerMove({ x: -20, y: -30 });

    const draft = useInteractionStore.getState().draftElement;
    expect(draft).toMatchObject({ x: -20, y: -30, width: 30, height: 50 });
    expect(draft?.props.points).toEqual([[10, 20], [-20, -30]]);
    expect(useInteractionStore.getState().resizeHandle).toBe('nw');
  });

  it('commits normalized positive bounds after flipping across both axes', () => {
    const el = makeElement({ id: 'rect-flip-commit', version: 1 });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);
    onSelectHandlePointerDown('se', { x: 110, y: 60 });

    onSelectPointerMove({ x: -20, y: -30 });
    onSelectPointerUp({ x: -20, y: -30 });

    const updated = useElementsStore.getState().elements.find((item) => item.id === el.id)!;
    expect(updated).toMatchObject({
      x: -20,
      y: -30,
      width: 30,
      height: 40,
      version: 2,
    });
    expect(updated.width).toBeGreaterThan(0);
    expect(updated.height).toBeGreaterThan(0);
    expect(useInteractionStore.getState().resizeSession).toBeNull();
    expect(useInteractionStore.getState().resizeHandle).toBeNull();
  });
});

describe('P1A-03 — Delete', () => {
  // @covers AC-9 (002-move-resize-delete)
  it('Delete key sets isDeleted = true on the selected element', () => {
    const el = makeElement({ id: 'del-1' });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);

    onSelectKeyDown('Delete');

    const after = useElementsStore.getState().elements.find((e) => e.id === 'del-1')!;
    expect(after.isDeleted).toBe(true);
  });

  // @covers AC-11 (002-move-resize-delete)
  it('Delete key clears selectedIds', () => {
    const el = makeElement({ id: 'del-2' });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);

    onSelectKeyDown('Delete');

    expect(useInteractionStore.getState().selectedIds).toEqual([]);
  });

  // @covers AC-12 (002-move-resize-delete)
  it('Delete key is a no-op when no shape is selected', () => {
    const el = makeElement({ id: 'del-3' });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([]);

    expect(() => onSelectKeyDown('Delete')).not.toThrow();
    const stored = useElementsStore.getState().elements.find((e) => e.id === 'del-3')!;
    expect(stored.isDeleted).toBe(false);
  });

  it('Backspace key also triggers soft delete', () => {
    const el = makeElement({ id: 'del-4' });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);

    onSelectKeyDown('Backspace');

    const after = useElementsStore.getState().elements.find((e) => e.id === 'del-4')!;
    expect(after.isDeleted).toBe(true);
  });
});

describe('P1A-03 — onSelectHandlePointerDown', () => {
  it('sets draggingId, dragStart, and resizeHandle from selected shape', () => {
    const el = makeElement({ id: 'res-1' });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);

    onSelectHandlePointerDown('se', { x: 110, y: 60 });

    expect(useInteractionStore.getState().draggingId).toBe(el.id);
    expect(useInteractionStore.getState().dragStart).toEqual({ x: 110, y: 60 });
    expect(useInteractionStore.getState().resizeHandle).toBe('se');
    expect(useInteractionStore.getState().resizeSession).toEqual({
      originalBounds: { x: 10, y: 10, width: 100, height: 50 },
      originalHandle: 'se',
      anchor: { x: 10, y: 10 },
    });
  });

  it('is a no-op when no shape is selected', () => {
    useInteractionStore.getState().setSelectedIds([]);

    onSelectHandlePointerDown('se', { x: 110, y: 60 });

    expect(useInteractionStore.getState().draggingId).toBeNull();
  });
});
