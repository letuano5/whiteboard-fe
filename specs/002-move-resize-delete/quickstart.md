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
2. Drag the `se` handle far inward (past center).

**Expected**: Shape stops at 1×1 world unit; it does NOT invert or disappear.

## Scenario 5 — Delete with keyboard

1. Select a shape.
2. Press `Delete` or `Backspace`.

**Expected**: Shape disappears immediately. Selection is cleared.

## Scenario 6 — No-op when nothing is selected

1. Click empty canvas to deselect.
2. Press `Delete`.

**Expected**: Nothing happens; no error in console.

## Automated test run

```bash
pnpm test src/canvas/tools/__tests__/select-tool.test.ts
```

All 12 AC-tagged tests should pass (AC-1 through AC-12).
