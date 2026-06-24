# Quickstart Validation: P1B-01 Rotate + Resize for Rotated Shapes

## Prerequisites

- Dev server running: `pnpm dev`
- Browser open at `http://localhost:5173`
- Tests passing: `pnpm test`

## Scenario 1 — Rotate a shape (AC-1, AC-2, AC-3, AC-4)

1. Select the **Rectangle** tool and draw a rectangle on the canvas.
2. Switch to the **Select** tool and click the rectangle.
3. A rotate handle (circle above the top edge of the selection ring) appears.
4. Drag the rotate handle clockwise ~90°.
   - **Expected**: shape rotates in real time around its center.
5. Release the drag.
   - **Expected**: shape remains at ~90° after release; re-selecting it shows the handle at the rotated position.
6. Repeat with Ellipse, Line, and Text tools.
   - **Expected**: all shape types rotate correctly.

## Scenario 2 — Hit-test on rotated shape (AC-5, AC-6, AC-7)

1. Draw a rectangle, rotate it 45°, deselect (click empty canvas).
2. Click on the visible corner of the rotated rectangle (a diamond shape now).
   - **Expected**: rectangle is selected.
3. Click in the corner of the invisible axis-aligned bounding box (empty space at the original corner).
   - **Expected**: nothing is selected.
4. Draw a second rectangle overlapping the first; rotate the second one 20°; stack them so the second has a higher zIndex.
5. Click the visible overlap area.
   - **Expected**: the shape with the higher `zIndex` is selected.

## Scenario 3 — Resize a rotated shape (AC-8, AC-9, AC-10)

1. Draw a rectangle and rotate it 30°.
2. Click the bottom-right handle (now appearing at the bottom-right of the rotated selection ring).
3. Drag the handle away from the opposite corner.
   - **Expected**: shape grows while remaining at 30° rotation.
4. Release.
   - **Expected**: shape persists at the new size and same angle.
5. Drag the same handle past the opposite corner (flip test).
   - **Expected**: shape flips but keeps positive dimensions; handle jumps to the logical opposite position.

## Scenario 4 — Regression check (AC-12)

1. Draw a rectangle (angle = 0). Resize and move it normally.
   - **Expected**: identical behavior to Phase 1A — no change.

## Scenario 5 — Persistence (AC-13)

1. Rotate a shape, then reload the page.
   - **Expected**: shape appears at the same angle after reload.

## Automated tests

Run `pnpm test` — all AC-1 through AC-13 must have a `@covers AC-n` test that passes.

Key test files (to be created in Phase 5):
- `src/utils/geometry.test.ts` — `rotatePoint` / `unrotatePoint`
- `src/canvas/tools/__tests__/rotate-tool.test.ts` — rotate interaction
- `src/canvas/tools/__tests__/select-tool-rotated.test.ts` — hit-test and resize with rotation
