# Quickstart Validation Guide: Multi-select + Copy-Paste (P2-08)

**Date**: 2026-06-27

## Prerequisites

- Node 22 + pnpm 10 installed.
- Run `pnpm install` from repo root.
- Backend running: `pnpm --filter whiteboard-be dev` (or any room URL works).

## Run the Dev Server

```bash
pnpm dev:all
# Open: http://localhost:5173/?room=<any-uuid>
```

## Validation Scenarios

### S1 — Marquee Selection (AC-1, AC-2, AC-3)

1. Create 3 rectangles separated by at least 50px.
2. Click on empty canvas and drag a rectangle that covers 2 of them.
3. **Expected**: 2 shapes highlighted with blue bounding box; third is not.
4. Release mouse.
5. **Expected**: Rubber-band rectangle disappears; 2 shapes stay selected.
6. Drag on empty canvas without covering any shape.
7. **Expected**: Selection clears (nothing selected).

### S2 — Shift-click (AC-4, AC-5, AC-6, AC-7)

1. Click one rectangle → selected.
2. Shift-click a second rectangle.
3. **Expected**: Both selected.
4. Shift-click the first rectangle.
5. **Expected**: Only second remains selected.
6. Click empty canvas.
7. **Expected**: Selection cleared.

### S3 — Bulk Move (AC-8)

1. Select 2 shapes via marquee.
2. Drag one of them by ~100px.
3. **Expected**: Both shapes move by the same offset.

### S4 — Bulk Style (AC-9)

1. Select 2+ shapes.
2. Open detail panel (shows when multi-selected).
3. Change stroke color.
4. **Expected**: All selected shapes update.

### S5 — Bulk Delete (AC-10)

1. Select 2+ shapes.
2. Press Delete or Backspace.
3. **Expected**: All selected shapes removed.

### S6 — Duplicate Ctrl+D (AC-11, AC-12, AC-13)

1. Select 1 shape, press Ctrl+D.
2. **Expected**: Copy appears at (+10, +10); copy is selected; original deselected.
3. Undo (Ctrl+Z) → copy removed (single undo step).
4. Select 2 shapes, press Ctrl+D.
5. **Expected**: Both copied at (+10, +10); copies selected; originals deselected.
6. Press Ctrl+D with nothing selected → no-op.

### S7 — Copy/Paste Ctrl+C / Ctrl+V (AC-14, AC-15, AC-16, AC-17)

1. Select 2 shapes, press Ctrl+C.
2. **Expected**: Selection unchanged; clipboard populated.
3. Press Ctrl+V.
4. **Expected**: 2 copies at (+10, +10) selected.
5. Press Ctrl+V again.
6. **Expected**: 2 more copies at (+20, +20).
7. Press Ctrl+V with nothing in clipboard → no-op.

## Run Unit Tests

```bash
pnpm --filter whiteboard-fe test
```

All tests under `frontend/src/canvas/tools/__tests__/select-tool.test.ts` must pass.
