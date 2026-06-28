import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ARROW_SNAP_THRESHOLD,
  getAttachmentPoints,
  findNearestSnap,
  parseBinding,
  computeBindingPoint,
} from '../arrow-binding';
import type { Element } from '../../../types/shared';
import { useElementsStore } from '../../../store/elements.store';
import {
  createElement,
  patchElement,
  registerMutationHook,
} from '../../../store/mutation-pipeline';

// ── helpers ──────────────────────────────────────────────────────────────────

const BASE: Omit<Element, 'id' | 'zIndex'> = {
  type: 'rectangle',
  x: 100,
  y: 100,
  width: 100,
  height: 60,
  angle: 0,
  props: {
    strokeColor: '#000',
    fillColor: 'transparent',
    strokeWidth: 2,
    strokeStyle: 'solid',
    opacity: 1,
  },
  groupId: null,
  frameId: null,
  locked: false,
  createdBy: 'test',
  version: 1,
  versionNonce: 1,
  updatedAt: 0,
  isDeleted: false,
};

function makeEl(id: string, overrides: Partial<Element> = {}): Element {
  return { ...BASE, id, zIndex: 1, ...overrides };
}

function seedStore(els: Element[]) {
  useElementsStore.setState({ elements: els });
}

beforeEach(() => {
  useElementsStore.setState({ elements: [] });
  vi.clearAllMocks();
});

// ── AC-8: findNearestSnap snaps to nearest attachment point ──────────────────

// @covers AC-8
describe('findNearestSnap — AC-8', () => {
  it('AC-8a: point within threshold of shape centre → returns binding to centre', () => {
    const el = makeEl('shape-1', { x: 100, y: 100, width: 100, height: 60 });
    // Centre = (150, 130)
    const pt = { x: 152, y: 132 }; // 2.83px from centre, well within 20px
    const result = findNearestSnap(pt, [el], 'arrow-id');
    expect(result).not.toBeNull();
    expect(result!.elementId).toBe('shape-1');
    expect(result!.pointKey).toBe('center');
    expect(result!.x).toBe(150);
    expect(result!.y).toBe(130);
  });

  it('AC-8a: point outside threshold → returns null', () => {
    const el = makeEl('shape-1', { x: 0, y: 0, width: 50, height: 50 });
    // Centre = (25, 25); point is 30px away from centre (too far for all attachment points)
    const pt = { x: 80, y: 80 };
    const result = findNearestSnap(pt, [el], 'arrow-id');
    expect(result).toBeNull();
  });

  it('AC-8b: tie-breaking — shape with higher zIndex wins when equidistant', () => {
    // Two shapes, centres both at exact same distance from pt
    const el1 = makeEl('low-z', { x: 0, y: 0, width: 10, height: 10, zIndex: 1 });
    // centre1 = (5, 5)
    const el2 = makeEl('high-z', { x: 10, y: 0, width: 10, height: 10, zIndex: 5 });
    // centre2 = (15, 5)
    // Test point equidistant between the two shapes' top-edge midpoints
    // top midpoint of el1 = (5, 0); top midpoint of el2 = (15, 0)
    // distance from (10, 0) to each = 5; tie → higher zIndex wins
    const pt = { x: 10, y: 0 };
    const result = findNearestSnap(pt, [el1, el2], 'arrow-id');
    expect(result).not.toBeNull();
    expect(result!.elementId).toBe('high-z');
  });

  it('excludes the arrow element itself from snap candidates', () => {
    const el = makeEl('self', { x: 100, y: 100, width: 100, height: 60, type: 'rectangle' });
    const pt = { x: 150, y: 130 }; // on centre
    const result = findNearestSnap(pt, [el], 'self');
    expect(result).toBeNull();
  });

  it('excludes deleted elements', () => {
    const el = makeEl('del-shape', { x: 100, y: 100, width: 100, height: 60, isDeleted: true });
    const pt = { x: 150, y: 130 };
    const result = findNearestSnap(pt, [el], 'arrow-id');
    expect(result).toBeNull();
  });

  it('excludes arrow and line type elements from snap candidates', () => {
    const arrow = makeEl('other-arrow', { type: 'arrow', x: 100, y: 100, width: 10, height: 10 });
    const pt = { x: 105, y: 105 };
    const result = findNearestSnap(pt, [arrow], 'my-arrow');
    expect(result).toBeNull();
  });
});

// ── getAttachmentPoints ───────────────────────────────────────────────────────
describe('getAttachmentPoints', () => {
  it('returns 5 attachment points with correct world positions', () => {
    const el = makeEl('s1', { x: 100, y: 100, width: 200, height: 80 });
    const pts = getAttachmentPoints(el);
    expect(pts).toHaveLength(5);

    const center = pts.find((p) => p.key === 'center')!;
    expect(center.x).toBe(200);
    expect(center.y).toBe(140);

    const top = pts.find((p) => p.key === 'top')!;
    expect(top.x).toBe(200);
    expect(top.y).toBe(100);

    const right = pts.find((p) => p.key === 'right')!;
    expect(right.x).toBe(300);
    expect(right.y).toBe(140);

    const bottom = pts.find((p) => p.key === 'bottom')!;
    expect(bottom.x).toBe(200);
    expect(bottom.y).toBe(180);

    const left = pts.find((p) => p.key === 'left')!;
    expect(left.x).toBe(100);
    expect(left.y).toBe(140);
  });
});

// ── parseBinding ─────────────────────────────────────────────────────────────
describe('parseBinding', () => {
  it('parses a valid binding string', () => {
    expect(parseBinding('abc123:center')).toEqual({ elementId: 'abc123', pointKey: 'center' });
    expect(parseBinding('el-id:top')).toEqual({ elementId: 'el-id', pointKey: 'top' });
  });

  it('returns null for null/undefined', () => {
    expect(parseBinding(null)).toBeNull();
    expect(parseBinding(undefined)).toBeNull();
  });

  it('returns null for malformed strings', () => {
    expect(parseBinding('')).toBeNull();
    expect(parseBinding('no-colon')).toBeNull();
    expect(parseBinding('id:invalid-key')).toBeNull();
  });

  it('handles element IDs that contain colons (uses lastIndexOf)', () => {
    // "abc:def:center" — elementId is "abc:def", pointKey is "center"
    const result = parseBinding('abc:def:center');
    expect(result).not.toBeNull();
    expect(result!.elementId).toBe('abc:def');
    expect(result!.pointKey).toBe('center');
  });
});

// ── computeBindingPoint ────────────────────────────────────────────────────────
describe('computeBindingPoint', () => {
  it('returns correct world coordinates for each point key', () => {
    const el = makeEl('s1', { x: 50, y: 50, width: 100, height: 80 });

    expect(computeBindingPoint(el, 'center')).toEqual({ x: 100, y: 90 });
    expect(computeBindingPoint(el, 'top')).toEqual({ x: 100, y: 50 });
    expect(computeBindingPoint(el, 'right')).toEqual({ x: 150, y: 90 });
    expect(computeBindingPoint(el, 'bottom')).toEqual({ x: 100, y: 130 });
    expect(computeBindingPoint(el, 'left')).toEqual({ x: 50, y: 90 });
  });
});

// ── AC-9: arrow-binding-hook — shape move cascades arrow endpoint ─────────────

// @covers AC-9
describe('arrow-binding-hook — AC-9: shape move updates bound arrow endpoint', () => {
  it('AC-9: moving bound shape updates arrow props.points[1] to new centre', async () => {
    const { createArrowBindingHook } = await import('../../../sync/arrow-binding-hook');

    const shape = makeEl('shape-id', { x: 100, y: 100, width: 100, height: 60, zIndex: 1 });
    const arrowEl = makeEl('arrow-id', {
      type: 'arrow',
      x: 0,
      y: 0,
      width: 150,
      height: 130,
      props: {
        strokeColor: '#000',
        fillColor: 'transparent',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
        endBinding: 'shape-id:center',
        points: [
          [0, 0],
          [150, 130], // initial centre of shape (100+50, 100+30) = (150,130)
        ],
      },
      zIndex: 2,
    });
    seedStore([shape, arrowEl]);

    const unregister = registerMutationHook(createArrowBindingHook());

    // Move shape to x=200, y=200 → new centre = (250, 230)
    patchElement('shape-id', { x: 200, y: 200 });

    const updatedArrow = useElementsStore.getState().elements.find((e) => e.id === 'arrow-id')!;
    const points = updatedArrow.props.points!;
    expect(points[1][0]).toBeCloseTo(250);
    expect(points[1][1]).toBeCloseTo(230);
    expect(updatedArrow.props.endBinding).toBe('shape-id:center');

    unregister();
  });
});

// @covers AC-10
describe('arrow-binding-hook — AC-10: shape resize updates bound arrow endpoint', () => {
  it('AC-10: resizing bound shape updates bound endpoint to reflect new geometry', async () => {
    const { createArrowBindingHook } = await import('../../../sync/arrow-binding-hook');

    const shape = makeEl('shape-resize', { x: 0, y: 0, width: 100, height: 60, zIndex: 1 });
    // arrow bound at 'top' of shape → initial top = (50, 0)
    const arrowEl = makeEl('arr-resize', {
      type: 'arrow',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      props: {
        strokeColor: '#000',
        fillColor: 'transparent',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
        endBinding: 'shape-resize:top',
        points: [[0, 50], [50, 0]],
      },
      zIndex: 2,
    });
    seedStore([shape, arrowEl]);

    const unregister = registerMutationHook(createArrowBindingHook());

    // Resize shape: new width=200, height=80 → new top midpoint = (100, 0)
    patchElement('shape-resize', { width: 200, height: 80 });

    const updatedArrow = useElementsStore.getState().elements.find((e) => e.id === 'arr-resize')!;
    const points = updatedArrow.props.points!;
    expect(points[1][0]).toBeCloseTo(100); // x = 0 + 200/2 = 100
    expect(points[1][1]).toBeCloseTo(0);   // y = 0 (top edge unchanged)

    unregister();
  });
});

// @covers AC-11
describe('arrow-binding-hook — AC-11: bound shape deleted releases binding', () => {
  it('AC-11: deleted shape releases arrow binding; arrow not deleted; endpoint stays at last position', async () => {
    const { createArrowBindingHook } = await import('../../../sync/arrow-binding-hook');
    const { deleteElements } = await import('../../../store/mutation-pipeline');

    const shape = makeEl('del-target', { x: 100, y: 100, width: 100, height: 60, zIndex: 1 });
    const arrowEl = makeEl('arr-del', {
      type: 'arrow',
      x: 0,
      y: 0,
      width: 150,
      height: 130,
      props: {
        strokeColor: '#000',
        fillColor: 'transparent',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
        endBinding: 'del-target:center',
        points: [[0, 0], [150, 130]],
      },
      zIndex: 2,
    });
    seedStore([shape, arrowEl]);

    const unregister = registerMutationHook(createArrowBindingHook());

    deleteElements(['del-target']);

    const updatedArrow = useElementsStore.getState().elements.find((e) => e.id === 'arr-del')!;
    // Binding cleared
    expect(updatedArrow.props.endBinding ?? null).toBeNull();
    // Arrow itself is not deleted
    expect(updatedArrow.isDeleted).toBe(false);
    // Endpoint stays at last position (150, 130)
    const points = updatedArrow.props.points!;
    expect(points[1][0]).toBeCloseTo(150);
    expect(points[1][1]).toBeCloseTo(130);

    unregister();
  });
});

// @covers AC-12
describe('arrow endpoint released beyond threshold — AC-12', () => {
  it('AC-12: findNearestSnap returns null when endpoint > threshold from all shapes', () => {
    const shape = makeEl('s', { x: 0, y: 0, width: 50, height: 50 });
    // All attachment points of shape s are at x<=50, y<=50
    // Point far away → null
    const pt = { x: 300, y: 300 };
    const result = findNearestSnap(pt, [shape], 'arrow-id');
    expect(result).toBeNull();
  });
});

// @covers AC-13
describe('arrow endpoint released with no shapes nearby — AC-13', () => {
  it('AC-13: findNearestSnap returns null when no shapes are in range', () => {
    const result = findNearestSnap({ x: 0, y: 0 }, [], 'arrow-id');
    expect(result).toBeNull();
  });
});

// @covers AC-18
describe('undo/redo for arrow binding — AC-18', () => {
  it('AC-18: patchElement with endBinding can be undone via history store', async () => {
    // Set up history capture
    const { initHistoryCapture } = await import('../../../sync/history-capture');
    const { useHistoryStore } = await import('../../../store/history.store');

    useElementsStore.setState({ elements: [] });
    useHistoryStore.setState({ undoStack: [], redoStack: [], isApplying: false });

    const unregister = initHistoryCapture();

    // Create arrow without binding
    const arrowEl = createElement({
      type: 'arrow',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: 0,
      props: {
        strokeColor: '#000',
        fillColor: 'transparent',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
        points: [[0, 0], [100, 100]],
      },
      groupId: null,
      frameId: null,
      locked: false,
      createdBy: 'test',
    });

    expect(arrowEl.props.endBinding).toBeUndefined();

    // Add binding
    patchElement(arrowEl.id, {
      props: {
        ...arrowEl.props,
        endBinding: 'shape-abc:center',
        points: [[0, 0], [50, 50]],
      },
    });

    const withBinding = useElementsStore.getState().elements.find((e) => e.id === arrowEl.id)!;
    expect(withBinding.props.endBinding).toBe('shape-abc:center');

    // Undo the binding
    useHistoryStore.getState().undo();

    const afterUndo = useElementsStore.getState().elements.find((e) => e.id === arrowEl.id)!;
    // After undo we get back to the pre-patch state (binding undefined/absent)
    expect(afterUndo.props.endBinding ?? null).toBeNull();

    unregister();
  });
});

// @covers AC-17 (also partially covered in zorder.test.ts)
describe('undo/redo for z-order — AC-17', () => {
  it('AC-17: bringToFront then undo restores original zIndex', async () => {
    const { initHistoryCapture } = await import('../../../sync/history-capture');
    const { useHistoryStore } = await import('../../../store/history.store');
    const { bringToFront: _bringToFront } = await import('../../../store/zorder');

    useElementsStore.setState({ elements: [] });
    useHistoryStore.setState({ undoStack: [], redoStack: [], isApplying: false });

    const unregister = initHistoryCapture();

    const base = {
      type: 'rectangle' as const,
      x: 0, y: 0, width: 100, height: 50, angle: 0,
      props: { strokeColor: '#000', fillColor: 'transparent', strokeWidth: 2, strokeStyle: 'solid' as const, opacity: 1 },
      groupId: null, frameId: null, locked: false, createdBy: 'test',
    };
    const elA = createElement({ ...base });
    const elB = createElement({ ...base });

    const aZBefore = elA.zIndex;
    const bZBefore = elB.zIndex;

    // A is below B; bring A to front
    expect(aZBefore).toBeLessThan(bZBefore);

    _bringToFront(elA.id);

    const aZAfterBring = useElementsStore.getState().elements.find((e) => e.id === elA.id)!.zIndex;
    expect(aZAfterBring).toBeGreaterThan(bZBefore);

    // Undo
    useHistoryStore.getState().undo();

    const aZAfterUndo = useElementsStore.getState().elements.find((e) => e.id === elA.id)!.zIndex;
    expect(aZAfterUndo).toBe(aZBefore);

    unregister();
  });
});

// Snap threshold constant check
describe('ARROW_SNAP_THRESHOLD', () => {
  it('is 20 world pixels', () => {
    expect(ARROW_SNAP_THRESHOLD).toBe(20);
  });
});
