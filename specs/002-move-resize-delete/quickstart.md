# Quickstart Validation: P1A-03 Move / Resize / Delete

**Date**: 2026-06-23

## Prerequisites

- `pnpm dev` running (Vite dev server)
- At least one shape already on the canvas (use Rectangle tool to draw one)
- Select tool (V key or toolbar) active

## Scenario 1 — Move a shape

1. Click a shape to select it (bounding box + handles appear).
2. Click and drag the shape body (not a handle).
3. Release the pointer.

**Expected**: Shape appears at the new location. Its `x`/`y` in the store reflect the drop position.

## Scenario 2 — Resize from SE corner

1. Select a shape.
2. Drag the bottom-right (`se`) handle outward.

**Expected**: Shape grows in width and height. Top-left corner (`x`, `y`) stays fixed.

## Scenario 3 — Resize from NW corner

1. Select a shape.
2. Drag the top-left (`nw`) handle.

**Expected**: All four sides move; shape shrinks or grows based on drag direction.

## Scenario 4 — Minimum size clamp

1. Select a small shape.
2. Drag the `se` handle exactly onto its fixed `nw` anchor.

**Expected**: Shape remains at 1×1 world unit. Continuing past the anchor starts resize-with-flip instead of stopping.

## Scenario 5 — Delete with keyboard

1. Select a shape.
2. Press `Delete` or `Backspace`.

**Expected**: Shape disappears immediately. Selection is cleared.

## Scenario 6 — No-op when nothing is selected

1. Click empty canvas to deselect.
2. Press `Delete`.

**Expected**: Nothing happens; no error in console.

## Scenario 7 — Move and resize a line

1. Draw a diagonal line and select it.
2. Drag the line body, then release.
3. Drag the `se` handle to resize it.

**Expected**: The visible line moves and resizes together with its selection box. Clicking the line at its new position still selects it.

## Scenario 8 — Resize through opposite corner

1. Select a rectangle.
2. Drag the `se` handle past the left side only.
3. Repeat past the top side only.
4. Repeat past both the left and top sides.

**Expected**: Resize continues without stopping. The logical corner becomes `sw`, `ne`, then `nw`; the selection handles remain attached and dimensions stay positive.

## Scenario 9 — Flip a line through resize

1. Select a diagonal line.
2. Drag one corner handle through its fixed opposite corner.

**Expected**: The line mirrors on each crossed axis. Its fixed endpoint remains fixed, its dragged endpoint follows the pointer, and the bbox stays normalized.

## Automated test run

```bash
pnpm test src/canvas/tools/__tests__/select-tool.test.ts
```

All 19 AC-tagged criteria should pass (AC-1 through AC-19).
