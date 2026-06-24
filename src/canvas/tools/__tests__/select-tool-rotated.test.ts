import { describe, it, expect, beforeEach } from 'vitest';
import {
  onSelectPointerDown,
  onSelectPointerMove,
  onSelectPointerUp,
  onSelectHandlePointerDown,
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
    width: 10,
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
  useInteractionStore.getState().setResizeHandle(null);
  useInteractionStore.getState().setResizeSession(null);
  useInteractionStore.getState().setIsRotating(false);
});

// ─── US2: Hit-test for rotated shapes ────────────────────────────────────────
//
// Element: x=10, y=10, w=10, h=100, angle=π/2
// Center: (15, 60)
// After 90° rotation the rectangle spans approx x ∈ [-35,65], y ∈ [55,65].
// - (15, 60) = center → always inside ✓
// - (15, 100) = inside original AABB (x ∈ [10,20], y ∈ [10,110]) but OUTSIDE rotated rectangle
//   Un-rotating (15,100) around (15,60) by -π/2:
//     dx=0, dy=40 → cos(π/2)=0, sin(π/2)=1
//     x'=15+0*0-40*(-1)=55 (NOT in [10,20]) → hitTest returns false ✓

describe('US2 — Hit-test for rotated shapes', () => {
  // @covers AC-5
  it('clicking center of a 90°-rotated rectangle selects it', () => {
    const el = makeElement({
      id: 'rot-hit-1',
      x: 10,
      y: 10,
      width: 10,
      height: 100,
      angle: Math.PI / 2,
    });
    useElementsStore.getState().setElements([el]);

    // Center at (15, 60) — always inside regardless of rotation
    onSelectPointerDown({ x: 15, y: 60 });

    expect(useInteractionStore.getState().selectedIds).toContain('rot-hit-1');
  });

  // @covers AC-6
  it('clicking inside original AABB but outside rotated body does NOT select', () => {
    const el = makeElement({
      id: 'rot-hit-2',
      x: 10,
      y: 10,
      width: 10,
      height: 100,
      angle: Math.PI / 2,
    });
    useElementsStore.getState().setElements([el]);

    // (15, 100): inside original AABB, but outside rotated body (un-rotated x ≈ 55, outside [10,20])
    onSelectPointerDown({ x: 15, y: 100 });

    expect(useInteractionStore.getState().selectedIds).toEqual([]);
  });

  // @covers AC-7
  it('overlapping rotated shapes: higher zIndex is selected', () => {
    const low = makeElement({
      id: 'low-z',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      zIndex: 1,
    });
    const high = makeElement({
      id: 'high-z',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      zIndex: 2,
    });
    useElementsStore.getState().setElements([low, high]);

    // Click at center (50, 50) — inside both shapes (center is rotation-invariant)
    onSelectPointerDown({ x: 50, y: 50 });

    expect(useInteractionStore.getState().selectedIds).toEqual(['high-z']);
  });
});

// ─── US3: Resize for rotated shapes ─────────────────────────────────────────
//
// For a rectangle at x=10, y=10, w=100, h=50, angle=π/6 (30°):
// Center: (60, 35)
// Anchors are in local (un-rotated) coordinates.
// When we drag the 'se' handle, the resize should produce a larger bbox.

describe('US3 — Resize for rotated shapes', () => {
  // @covers AC-8
  it('resizing a rotated shape produces a draftElement with updated dimensions while angle is unchanged', () => {
    const angle = Math.PI / 6; // 30°
    const el = makeElement({
      id: 'rot-res-1',
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      angle,
    });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);

    // Start resize on 'se' handle (anchor is nw corner = (10,10) in local space)
    onSelectHandlePointerDown('se', { x: 110, y: 60 });

    // The pointer in world space needs to be un-rotated to local space.
    // We move it toward the 'se' direction in world space.
    // In local space (un-rotated), this corresponds to going to (160, 80).
    // To simulate: rotate (160,80) around center (60,35) by +angle to get world pointer.
    const cx = 60, cy = 35;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const localTarget = { x: 160, y: 80 };
    const worldPointer = {
      x: cx + (localTarget.x - cx) * cos - (localTarget.y - cy) * sin,
      y: cy + (localTarget.x - cx) * sin + (localTarget.y - cy) * cos,
    };

    onSelectPointerMove(worldPointer);

    const draft = useInteractionStore.getState().draftElement;
    expect(draft).not.toBeNull();
    // Dimensions should be approximately (150 × 70) in local frame
    expect(draft!.width).toBeCloseTo(150, 0);
    expect(draft!.height).toBeCloseTo(70, 0);
    // Angle must be unchanged
    expect(draft!.angle).toBeCloseTo(angle, 4);
  });

  // @covers AC-9
  it('pointerUp after rotated resize commits x,y,w,h with unchanged angle', () => {
    const angle = Math.PI / 6;
    const el = makeElement({
      id: 'rot-res-2',
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      angle,
      version: 1,
    });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);
    onSelectHandlePointerDown('se', { x: 110, y: 60 });

    const cx = 60, cy = 35;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const localTarget = { x: 160, y: 80 };
    const worldPointer = {
      x: cx + (localTarget.x - cx) * cos - (localTarget.y - cy) * sin,
      y: cy + (localTarget.x - cx) * sin + (localTarget.y - cy) * cos,
    };

    onSelectPointerMove(worldPointer);
    onSelectPointerUp(worldPointer);

    const updated = useElementsStore.getState().elements.find((e) => e.id === 'rot-res-2')!;
    expect(updated.width).toBeCloseTo(150, 0);
    expect(updated.height).toBeCloseTo(70, 0);
    // Angle must be unchanged in committed element
    expect(updated.angle).toBeCloseTo(angle, 4);
    // Version incremented (pipeline ran)
    expect(updated.version).toBe(2);
  });

  // @covers AC-10
  it('flip during resize of rotated shape: width and height remain positive', () => {
    const el = makeElement({
      id: 'rot-res-3',
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      angle: 0, // simpler flip test with angle=0 to isolate the flip logic
    });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);
    onSelectHandlePointerDown('se', { x: 110, y: 60 });

    // Drag well past the anchor (nw corner at 10,10)
    onSelectPointerMove({ x: -20, y: -30 });

    const draft = useInteractionStore.getState().draftElement;
    expect(draft!.width).toBeGreaterThan(0);
    expect(draft!.height).toBeGreaterThan(0);
    expect(useInteractionStore.getState().resizeHandle).toBe('nw');
  });

  // @covers AC-11
  it('resize of a line element scales props.points to match new bbox', () => {
    const el = makeElement({
      id: 'rot-line-1',
      type: 'line',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      angle: 0,
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
    expect(draft!.props.points).toEqual([[160, 20], [10, 100]]);
  });
});

// ─── Regression guard ─────────────────────────────────────────────────────────

describe('AC-12 — Regression: angle=0 shapes behave identically to P1A', () => {
  // @covers AC-12
  it('clicking inside axis-aligned bbox of angle=0 shape selects it (unchanged behavior)', () => {
    const el = makeElement({
      id: 'reg-1',
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      angle: 0,
    });
    useElementsStore.getState().setElements([el]);

    onSelectPointerDown({ x: 60, y: 35 });

    expect(useInteractionStore.getState().selectedIds).toContain('reg-1');
  });

  // @covers AC-12
  it('clicking outside bbox of angle=0 shape does NOT select it (unchanged behavior)', () => {
    const el = makeElement({
      id: 'reg-2',
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      angle: 0,
    });
    useElementsStore.getState().setElements([el]);

    onSelectPointerDown({ x: 500, y: 500 });

    expect(useInteractionStore.getState().selectedIds).toEqual([]);
  });

  // @covers AC-12
  it('hit-test with angle=0: unrotatePoint is identity, result same as direct AABB test', () => {
    const el = makeElement({
      id: 'reg-3',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: 0,
    });
    useElementsStore.getState().setElements([el]);

    // Point exactly at (1, 1) — just inside top-left corner
    onSelectPointerDown({ x: 1, y: 1 });
    expect(useInteractionStore.getState().selectedIds).toContain('reg-3');

    useInteractionStore.getState().setSelectedIds([]);

    // Point at (99, 99) — just inside bottom-right corner
    onSelectPointerDown({ x: 99, y: 99 });
    expect(useInteractionStore.getState().selectedIds).toContain('reg-3');
  });
});
