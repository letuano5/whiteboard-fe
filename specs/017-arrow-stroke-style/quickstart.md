# Quickstart Validation Guide: Arrow + Stroke Style (P2-09)

**Date**: 2026-06-27

## Prerequisites

- `pnpm install` from repo root.
- Dev server: `pnpm dev:all`
- Open: `http://localhost:5173/?room=<any-uuid>`

## Validation Scenarios

### S1 — Draw an Arrow (AC-1, AC-2)

1. Click the Arrow tool in the toolbar.
2. Click-drag from point A to point B (~100px away).
3. **Expected**: A straight line with a filled triangular arrowhead appears at point B, pointing from A to B.

### S2 — Zero-length Drag Discarded (AC-5)

1. Select Arrow tool.
2. Click without dragging (or drag < 2px).
3. **Expected**: No arrow shape is created.

### S3 — Select Arrow (AC-13, AC-14)

1. Draw an arrow.
2. Switch to Select tool; click on the arrow body.
3. **Expected**: Arrow selected with handles at tail and head.
4. Drag the arrow body.
5. **Expected**: Both tail and head move by same offset.

### S4 — Resize Arrow Endpoints (AC-3)

1. With arrow selected, drag the tail handle to a new position.
2. **Expected**: Tail moves; head stays; arrowhead direction updates.
3. Drag the head handle.
4. **Expected**: Head moves; tail stays.

### S5 — Delete Arrow (AC-4)

1. With arrow selected, press Delete or Backspace.
2. **Expected**: Arrow removed from canvas.

### S6 — Stroke Style Selector (AC-6, AC-7, AC-8, AC-9)

1. Draw a rectangle and select it.
2. In the detail panel, find the "Stroke style" dropdown.
3. Select "Dashed" → rectangle stroke becomes dashed.
4. Select "Dotted" → stroke becomes dotted.
5. Select "Solid" → stroke becomes solid (default).
6. Create a new shape → stroke style defaults to "Solid".

### S7 — Stroke Style Persists (AC-10)

1. Set a shape's stroke style to "dashed".
2. Refresh the page (same room URL).
3. **Expected**: Shape still shows dashed stroke.

### S8 — Stroke Style UI (AC-11, AC-12)

1. Select the style panel shows the Stroke style control.
2. Select 2 shapes (via P2-08 multi-select); change stroke style.
3. **Expected**: Both shapes update.

### S9 — Arrow Common Operations (AC-13..AC-16)

1. Draw an arrow; select it.
2. Change stroke color → arrow line and arrowhead update.
3. Marquee-select multiple shapes including the arrow → arrow included in selection.

## Run Unit Tests

```bash
pnpm --filter whiteboard-fe test
```

Tests in `frontend/src/canvas/shapes/__tests__/arrow.test.ts` must pass.
