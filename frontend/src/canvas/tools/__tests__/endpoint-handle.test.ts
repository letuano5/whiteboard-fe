import { describe, it, expect, beforeEach } from 'vitest';
import { onSelectHandlePointerDown, onSelectPointerMove, onSelectPointerUp } from '../select-tool';
import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import type { Element } from '../../../types/shared';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeArrow(overrides: Partial<Element> = {}): Element {
  return {
    id: 'arrow-1',
    type: 'arrow',
    x: 10,
    y: 20,
    width: 90,
    height: 80,
    angle: 0,
    zIndex: 1,
    props: {
      strokeColor: '#000',
      fillColor: 'none',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
      points: [
        [10, 20],
        [100, 100],
      ],
    },
    version: 1,
    versionNonce: 1,
    updatedAt: Date.now(),
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
    ...overrides,
  };
}

function makeRect(id: string, x: number, y: number, w: number, h: number): Element {
  return {
    id,
    type: 'rectangle',
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    zIndex: 2,
    props: {
      strokeColor: '#000',
      fillColor: '#fff',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
    },
    version: 1,
    versionNonce: 1,
    updatedAt: Date.now(),
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
  };
}

beforeEach(() => {
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().setSelectedIds([]);
  useInteractionStore.getState().setDraggingId(null);
  useInteractionStore.getState().setDragStart(null);
  useInteractionStore.getState().setResizeHandle(null);
  useInteractionStore.getState().setResizeSession(null);
  useInteractionStore.getState().setDraftElement(null);
  useInteractionStore.getState().setDraftElements([]);
});

// ── AC-5: SelectionOverlay renders 2 endpoint handles for arrow ───────────────

// @covers AC-5
describe('AC-5: onSelectHandlePointerDown with ep-start sets correct store state', () => {
  it('ep-start: sets resizeHandle=ep-start, resizeSession=null, draggingId=arrow-1', () => {
    const arrow = makeArrow({ id: 'arrow-1' });
    useElementsStore.getState().setElements([arrow]);
    useInteractionStore.getState().setSelectedIds(['arrow-1']);

    onSelectHandlePointerDown('ep-start', { x: 10, y: 20 });

    const state = useInteractionStore.getState();
    expect(state.draggingId).toBe('arrow-1');
    expect(state.dragStart).toEqual({ x: 10, y: 20 });
    expect(state.resizeHandle).toBe('ep-start');
    expect(state.resizeSession).toBeNull();
  });

  it('ep-end: sets resizeHandle=ep-end, resizeSession=null, draggingId=arrow-1', () => {
    const arrow = makeArrow({ id: 'arrow-1' });
    useElementsStore.getState().setElements([arrow]);
    useInteractionStore.getState().setSelectedIds(['arrow-1']);

    onSelectHandlePointerDown('ep-end', { x: 100, y: 100 });

    const state = useInteractionStore.getState();
    expect(state.draggingId).toBe('arrow-1');
    expect(state.resizeHandle).toBe('ep-end');
    expect(state.resizeSession).toBeNull();
  });

  it('is a no-op when no shape is selected', () => {
    useInteractionStore.getState().setSelectedIds([]);

    onSelectHandlePointerDown('ep-start', { x: 10, y: 20 });

    expect(useInteractionStore.getState().draggingId).toBeNull();
  });
});

// ── AC-6: onSelectPointerMove updates the correct endpoint ───────────────────

// @covers AC-6
describe('AC-6: onSelectPointerMove with ep-start updates props.points[0]', () => {
  it('moving ep-start updates only points[0], leaving points[1] unchanged', () => {
    const arrow = makeArrow({ id: 'arrow-1' });
    useElementsStore.getState().setElements([arrow]);
    useInteractionStore.getState().setSelectedIds(['arrow-1']);
    useInteractionStore.getState().setDraggingId('arrow-1');
    useInteractionStore.getState().setDragStart({ x: 10, y: 20 });
    useInteractionStore.getState().setResizeHandle('ep-start');

    onSelectPointerMove({ x: 50, y: 60 });

    const draft = useInteractionStore.getState().draftElement;
    expect(draft).not.toBeNull();
    // points[0] updated to pointer position
    expect(draft?.props.points?.[0]).toEqual([50, 60]);
    // points[1] unchanged
    expect(draft?.props.points?.[1]).toEqual([100, 100]);
  });

  // @covers AC-6
  it('moving ep-end updates only points[1], leaving points[0] unchanged', () => {
    const arrow = makeArrow({ id: 'arrow-1' });
    useElementsStore.getState().setElements([arrow]);
    useInteractionStore.getState().setSelectedIds(['arrow-1']);
    useInteractionStore.getState().setDraggingId('arrow-1');
    useInteractionStore.getState().setDragStart({ x: 100, y: 100 });
    useInteractionStore.getState().setResizeHandle('ep-end');

    onSelectPointerMove({ x: 200, y: 250 });

    const draft = useInteractionStore.getState().draftElement;
    expect(draft).not.toBeNull();
    // points[0] unchanged
    expect(draft?.props.points?.[0]).toEqual([10, 20]);
    // points[1] updated to pointer position
    expect(draft?.props.points?.[1]).toEqual([200, 250]);
  });

  it('bbox is normalised correctly after endpoint drag', () => {
    const arrow = makeArrow({ id: 'arrow-1' });
    useElementsStore.getState().setElements([arrow]);
    useInteractionStore.getState().setSelectedIds(['arrow-1']);
    useInteractionStore.getState().setDraggingId('arrow-1');
    useInteractionStore.getState().setDragStart({ x: 10, y: 20 });
    useInteractionStore.getState().setResizeHandle('ep-start');

    // Move start point to (5, 5); end point at (100, 100)
    // => bbox: x=5, y=5, w=95, h=95
    onSelectPointerMove({ x: 5, y: 5 });

    const draft = useInteractionStore.getState().draftElement;
    expect(draft).toMatchObject({ x: 5, y: 5, width: 95, height: 95 });
  });
});

// ── AC-6 commit: onSelectPointerUp stores updated points[0] ──────────────────

// @covers AC-6
describe('AC-6: onSelectPointerUp commits updated endpoint to store', () => {
  it('committing ep-start drag writes props.points[0] to element store', () => {
    const arrow = makeArrow({ id: 'arrow-1', version: 1 });
    useElementsStore.getState().setElements([arrow]);
    useInteractionStore.getState().setSelectedIds(['arrow-1']);
    useInteractionStore.getState().setDraggingId('arrow-1');
    useInteractionStore.getState().setDragStart({ x: 10, y: 20 });
    useInteractionStore.getState().setResizeHandle('ep-start');

    // Set up draft with moved start point
    useInteractionStore.getState().setDraftElement({
      ...arrow,
      x: 50,
      y: 60,
      width: 50,
      height: 40,
      props: {
        ...arrow.props,
        points: [
          [50, 60],
          [100, 100],
        ],
      },
    });

    onSelectPointerUp({ x: 50, y: 60 });

    const updated = useElementsStore.getState().elements.find((e) => e.id === 'arrow-1')!;
    expect(updated.props.points?.[0]).toEqual([50, 60]);
    expect(updated.props.points?.[1]).toEqual([100, 100]);
    expect(updated.version).toBe(2);
  });

  it('committing ep-end drag writes props.points[1] to element store', () => {
    const arrow = makeArrow({ id: 'arrow-1', version: 1 });
    useElementsStore.getState().setElements([arrow]);
    useInteractionStore.getState().setSelectedIds(['arrow-1']);
    useInteractionStore.getState().setDraggingId('arrow-1');
    useInteractionStore.getState().setDragStart({ x: 100, y: 100 });
    useInteractionStore.getState().setResizeHandle('ep-end');

    useInteractionStore.getState().setDraftElement({
      ...arrow,
      x: 10,
      y: 20,
      width: 190,
      height: 180,
      props: {
        ...arrow.props,
        points: [
          [10, 20],
          [200, 200],
        ],
      },
    });

    onSelectPointerUp({ x: 200, y: 200 });

    const updated = useElementsStore.getState().elements.find((e) => e.id === 'arrow-1')!;
    expect(updated.props.points?.[0]).toEqual([10, 20]);
    expect(updated.props.points?.[1]).toEqual([200, 200]);
  });
});

// ── AC-7: snap binding applies when endpoint released over target ─────────────

// @covers AC-7
describe('AC-7: snap binding on ep-end release near a target shape', () => {
  it('endBinding is set when ep-end released within snap threshold of target', () => {
    // Target rect: center at (150, 130) = x:100, y:100, w:100, h:60
    const target = makeRect('target-1', 100, 100, 100, 60);
    const arrow = makeArrow({
      id: 'arrow-1',
      version: 1,
      props: {
        strokeColor: '#000',
        fillColor: 'none',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
        points: [
          [10, 20],
          [148, 128], // close to target center (150,130)
        ],
      },
    });

    useElementsStore.getState().setElements([target, arrow]);
    useInteractionStore.getState().setSelectedIds(['arrow-1']);
    useInteractionStore.getState().setDraggingId('arrow-1');
    useInteractionStore.getState().setDragStart({ x: 100, y: 100 });
    useInteractionStore.getState().setResizeHandle('ep-end');

    // Set draft with ep-end near target center
    useInteractionStore.getState().setDraftElement({
      ...arrow,
      props: {
        ...arrow.props,
        points: [
          [10, 20],
          [148, 128],
        ],
      },
    });

    onSelectPointerUp({ x: 148, y: 128 });

    const updated = useElementsStore.getState().elements.find((e) => e.id === 'arrow-1')!;
    // endBinding should be set to target's center attachment
    expect(updated.props.endBinding).toEqual({
      elementId: 'target-1',
      anchorRatio: { x: 0.5, y: 0.5 },
    });
    // Snap position: center is (150, 130)
    expect(updated.props.points?.[1][0]).toBeCloseTo(150);
    expect(updated.props.points?.[1][1]).toBeCloseTo(130);
  });

  it('endBinding cleared when ep-end released far from any target', () => {
    const arrow = makeArrow({
      id: 'arrow-1',
      version: 1,
      props: {
        strokeColor: '#000',
        fillColor: 'none',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
        endBinding: 'old-target:center',
        points: [
          [10, 20],
          [500, 500], // far from everything
        ],
      },
    });

    useElementsStore.getState().setElements([arrow]);
    useInteractionStore.getState().setSelectedIds(['arrow-1']);
    useInteractionStore.getState().setDraggingId('arrow-1');
    useInteractionStore.getState().setDragStart({ x: 100, y: 100 });
    useInteractionStore.getState().setResizeHandle('ep-end');

    useInteractionStore.getState().setDraftElement({ ...arrow });

    onSelectPointerUp({ x: 500, y: 500 });

    const updated = useElementsStore.getState().elements.find((e) => e.id === 'arrow-1')!;
    // endBinding should be cleared (was set, now no snap)
    expect(updated.props.endBinding ?? null).toBeNull();
  });

  it('startBinding untouched when only ep-end moves', () => {
    const target1 = makeRect('target-1', 0, 0, 60, 60);
    const arrow = makeArrow({
      id: 'arrow-1',
      version: 1,
      props: {
        strokeColor: '#000',
        fillColor: 'none',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
        startBinding: 'target-1:center',
        points: [
          [30, 30], // center of target-1
          [200, 200],
        ],
      },
    });

    useElementsStore.getState().setElements([target1, arrow]);
    useInteractionStore.getState().setSelectedIds(['arrow-1']);
    useInteractionStore.getState().setDraggingId('arrow-1');
    useInteractionStore.getState().setDragStart({ x: 200, y: 200 });
    useInteractionStore.getState().setResizeHandle('ep-end');

    useInteractionStore.getState().setDraftElement({
      ...arrow,
      props: {
        ...arrow.props,
        points: [
          [30, 30],
          [300, 300], // moved far, no snap
        ],
      },
    });

    onSelectPointerUp({ x: 300, y: 300 });

    const updated = useElementsStore.getState().elements.find((e) => e.id === 'arrow-1')!;
    // startBinding must be preserved
    expect(updated.props.startBinding).toBe('target-1:center');
  });
});

// ── Cleanup: interaction store reset after pointerUp ─────────────────────────
describe('store cleanup after endpoint drag', () => {
  it('resizeHandle is null after onSelectPointerUp', () => {
    const arrow = makeArrow({ id: 'arrow-1' });
    useElementsStore.getState().setElements([arrow]);
    useInteractionStore.getState().setSelectedIds(['arrow-1']);
    useInteractionStore.getState().setDraggingId('arrow-1');
    useInteractionStore.getState().setDragStart({ x: 10, y: 20 });
    useInteractionStore.getState().setResizeHandle('ep-start');
    useInteractionStore.getState().setDraftElement({ ...arrow });

    onSelectPointerUp({ x: 10, y: 20 });

    expect(useInteractionStore.getState().resizeHandle).toBeNull();
    expect(useInteractionStore.getState().draggingId).toBeNull();
    expect(useInteractionStore.getState().draftElement).toBeNull();
  });
});
