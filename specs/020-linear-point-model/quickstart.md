# Quickstart Validation Guide: Point-Based Model for Linear Elements

**Date**: 2026-06-29

## Prerequisites

```bash
# From repo root
pnpm install
pnpm dev:all   # starts frontend (Vite) + backend (Express/Socket.IO) in parallel
```

Open `http://localhost:5173` in a browser.

## Scenario 1 — Bounds always match points (AC-1, AC-2)

1. Select the **arrow** tool from the toolbar.
2. Draw an arrow from approximately (100, 100) to (300, 200).
3. Switch to the **select** tool and click the arrow.
4. **Verify**: The dashed selection box tightly encloses only the two endpoints —
   no gap between the box edges and the visible stroke.

Expected: blue dashed box touches both endpoints.
Bug condition: box is offset or has extra padding.

## Scenario 2 — Endpoint handles visible (AC-3)

1. Select any arrow or line.
2. **Verify**: Exactly **2 circular handles** are shown — one at the start point, one at the end.
   No corner (nw/ne/sw/se) or edge (n/s/e/w) handles appear.
   The rotate handle (circle above the bbox) is NOT shown for arrow/line.

Expected: 2 endpoint handles only.
Bug condition: 8 handles appear as before.

## Scenario 3 — Drag endpoint, binding snaps (AC-4)

1. Draw a rectangle somewhere on the canvas.
2. Draw an arrow near the rectangle (not bound).
3. Select the arrow; drag its end handle over the centre of the rectangle.
4. **Verify**: The endpoint snaps to the centre (blue ring indicator appears), and after
   release the arrow stays attached.
5. Move the rectangle — the arrow end should follow (via arrow-binding-hook).

Expected: snap ring visible on hover; arrow remains attached after move.
Bug condition: handle doesn't snap, or arrow detaches after release.

## Scenario 4 — Arrow follows dragged shape in real-time (AC-5 draft mode)

1. Bind an arrow's endpoint to a rectangle (use Scenario 3 above).
2. Select the rectangle and start dragging it (hold pointer down, move slowly).
3. **Verify**: While dragging (pointer still held), the arrow moves along with the rectangle
   — it does NOT wait for pointer-up to reposition.

Expected: arrow visually follows the rectangle during drag gesture.
Bug condition: arrow stays behind until pointer-up.

## Scenario 5 — Mutation normalises bounds

1. Open browser DevTools → Application → Local Storage → find the element store.
   (Or use Zustand devtools in browser extension.)
2. Draw an arrow. Inspect its stored data.
3. **Verify**: `x` equals `min(props.points.*.x)`, `y` equals `min(props.points.*.y)`,
   `width = max.x - min.x`, `height = max.y - min.y`.

## Scenario 6 — Undo/redo unaffected (AC-6)

1. Draw an arrow; drag its endpoint to a new position.
2. Press `Ctrl+Z` (or `Cmd+Z`).
3. **Verify**: The endpoint returns to its previous position.
4. Press `Ctrl+Shift+Z` — endpoint moves back to the dragged position.

## Running unit tests

```bash
pnpm test
```

All existing tests must pass. New test files:
- `frontend/src/utils/__tests__/linear-bounds.test.ts`
- `frontend/src/canvas/tools/__tests__/endpoint-handle.test.ts`

## References

- Data model: [data-model.md](./data-model.md)
- Spec: [spec.md](./spec.md)
