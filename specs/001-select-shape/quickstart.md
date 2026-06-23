# Quickstart Validation Guide: P1A-02 Select Shape

## Prerequisites

- Dev server running: `pnpm dev`
- Browser open at `http://localhost:5173`

## Manual Validation Scenarios

### Scenario 1 — Click to select (AC-1)

1. Click the rectangle tool in the toolbar.
2. Draw a rectangle by clicking and dragging on the canvas.
3. Click the select tool (arrow icon) in the toolbar.
4. Click inside the rectangle.
5. **Expected**: A dashed bounding box appears around the rectangle with 8 small circle handles.

### Scenario 2 — z-order priority when overlapping (AC-2)

1. Draw two shapes that overlap.
2. Switch to select tool.
3. Click the overlapping area.
4. **Expected**: The shape drawn last (higher `zIndex`) is selected.

### Scenario 3 — Switch selection (AC-3)

1. With two shapes on canvas, select tool active, click shape A.
2. Then click shape B (non-overlapping with A).
3. **Expected**: Shape B gets bounding box; shape A's bounding box disappears.

### Scenario 4 — Deselect by clicking empty (AC-4)

1. Click shape A so it is selected.
2. Click an empty area of the canvas.
3. **Expected**: Bounding box disappears; no shape is highlighted.

### Scenario 5 — Click empty with nothing selected (AC-5)

1. Ensure no shape is selected.
2. Click empty canvas.
3. **Expected**: Nothing happens; no visual change; no console errors.

## Automated Test Commands

```bash
# Run all unit tests
pnpm test

# Run only select-tool tests
pnpm test src/canvas/tools/__tests__/select-tool.test.ts

# Run only shape hitTest tests
pnpm test src/canvas/shapes/__tests__/shapes.test.tsx
```

## Expected Test Results

All tests green. AC-1 through AC-7 each covered by at least one test tagged `@covers AC-n`.
