# Quickstart Validation: Z-order UI & Arrow Binding

**Feature**: P2.5-02 + P2.5-03 | **Date**: 2026-06-28

## Prerequisites

```bash
# From repo root — start frontend + backend in parallel
pnpm dev:all
```

Open two browser tabs at `http://localhost:5173/?room=<same-uuid>` to validate sync scenarios.

---

## Scenario 1 — Z-order: Bring to Front (AC-1)

1. Draw two overlapping rectangles (Rectangle A, Rectangle B on top of A).
2. Right-click Rectangle A → context menu appears.
3. Click "Bring to Front".
4. **Expected**: Rectangle A is now on top of Rectangle B (A's zIndex > B's zIndex).
5. **Sync check**: In the second browser tab, A must also be on top without refreshing.

## Scenario 2 — Z-order: Send to Back (AC-2)

1. Draw three overlapping shapes; shape C is at the top.
2. Right-click C → "Send to Back".
3. **Expected**: C is behind both other shapes.

## Scenario 3 — Z-order: Forward / Backward (AC-3, AC-4)

1. Draw three shapes in order A (bottom), B (middle), C (top).
2. Right-click B → "Forward".
3. **Expected**: B is now above C; A remains at bottom.
4. Right-click B → "Backward" (B is now at top after step 3).
5. **Expected**: B is below C again; A remains at bottom.

## Scenario 4 — Z-order: Boundary No-op (AC-5, AC-6)

1. With the topmost element selected, right-click → "Bring to Front".
2. **Expected**: Nothing changes; no error.
3. With the bottommost element selected, right-click → "Send to Back".
4. **Expected**: Nothing changes; no error.

## Scenario 5 — Z-order: Multi-select disabled (AC-7)

1. Shift-click two shapes to create a multi-selection.
2. Right-click over the selection.
3. **Expected**: Z-order commands (Bring to Front etc.) are either absent or visually disabled.

## Scenario 6 — Arrow Binding: Snap on Draw (AC-8)

1. Draw a rectangle (Shape S).
2. Select the Arrow tool.
3. Start drawing an arrow; release the end endpoint within 20px of Shape S.
4. **Expected**: The end endpoint snaps to the nearest attachment point of S. A faint snap
   indicator (ring or highlight) is visible at the attachment point.
5. Inspect: the arrow element in the store has `props.endBinding` set to `"S.id:pointKey"`.

## Scenario 7 — Arrow Binding: Shape Move Follows (AC-9)

1. (Continue from Scenario 6) Move Shape S to a new position.
2. **Expected**: The bound end endpoint of the arrow moves to maintain the connection to S.
   No gap or dislocation is visible.

## Scenario 8 — Arrow Binding: Shape Resize Follows (AC-10)

1. Resize Shape S (drag a resize handle).
2. **Expected**: The bound arrow endpoint moves to the correct attachment point on the
   newly-sized shape.

## Scenario 9 — Arrow Binding: Bound Shape Deleted (AC-11)

1. Delete Shape S.
2. **Expected**: The arrow endpoint stays at the position S last occupied; the arrow is not
   deleted. `props.endBinding` is now `null`.

## Scenario 10 — Arrow Binding: Release Binding (AC-12)

1. Draw an arrow bound to Shape S.
2. Drag the bound endpoint away from S (beyond 20px) and release on empty canvas.
3. **Expected**: The endpoint is placed at the release position; `props.endBinding` is `null`.

## Scenario 11 — Arrow Binding: No Snap Outside Threshold (AC-13)

1. Draw an arrow with the end endpoint released more than 20px from all shapes.
2. **Expected**: No binding is saved; `props.endBinding` is `null`.

## Scenario 12 — Real-time Sync: Z-order (AC-14)

1. In Tab A, change a shape's z-order.
2. **Expected**: Tab B reflects the new stacking order within 500 ms.

## Scenario 13 — Real-time Sync: Binding Changes (AC-15, AC-16)

1. In Tab A, bind an arrow to a shape.
2. **Expected**: Tab B shows the snapped endpoint.
3. In Tab A, move the bound shape.
4. **Expected**: Tab B sees the arrow follow.

## Scenario 14 — Undo/Redo (AC-17, AC-18)

1. Apply a z-order change → Ctrl+Z → **Expected**: stacking order reverts.
2. Bind an arrow → Ctrl+Z → **Expected**: binding removed, endpoint returns to pre-snap position.
3. Ctrl+Y on each → **Expected**: redo re-applies the respective change.

---

## Unit Test Coverage

```bash
pnpm --filter whiteboard-fe test
```

Key test files:
- `frontend/src/store/__tests__/zorder.test.ts` — covers AC-1..AC-7 logic
- `frontend/src/canvas/shapes/__tests__/arrow-binding.test.ts` — covers AC-8..AC-16 snap/cascade
- `frontend/src/components/context-menu/__tests__/ContextMenu.test.tsx` — covers menu rendering
