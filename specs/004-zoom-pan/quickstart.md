# Quickstart Validation Guide — Zoom + Pan + Infinite Canvas

**Date**: 2026-06-24

## Prerequisites

```bash
cd frontend
pnpm install
pnpm dev   # starts on http://localhost:5173
```

## Manual validation scenarios

### SC1: Scroll-wheel zoom (AC-1, AC-2, AC-3, AC-4)

1. Open the app; place a Rectangle shape near the center of the canvas.
2. Hover the cursor over the Rectangle.
3. Scroll the mouse wheel **up** (zoom in) × 5 ticks — the Rectangle should grow and stay under the cursor.
4. Scroll **down** × 10 ticks — the Rectangle should shrink and stay under the cursor; zoom should not go below 0.1.
5. Scroll up repeatedly until zoom clamps at 8 — canvas should stay still.

Expected: shape stays under cursor throughout; min/max clamp silently applied.

### SC2: Hand tool pan (AC-5, AC-6, AC-7)

1. Click the Hand tool button in the toolbar (hand icon).
2. Click-drag anywhere on the canvas — the canvas should pan.
3. Release — canvas should stop and the new position should persist.
4. Create a shape at world position (500, 500) by briefly switching to Rectangle tool, drawing it, then switching back to Hand tool.
5. Pan to it — it should be visible and clickable (switch to Select to confirm).

Expected: smooth pan; shapes reachable at any world coordinate.

### SC3: Middle mouse button pan (AC-8, AC-9)

1. With the Select tool active and a shape selected, press the middle mouse button and drag.
2. Canvas should pan; shape selection should be unchanged after releasing.

Expected: pan works; tool/selection state unchanged.

### SC4: Space + drag temporary pan (AC-10, AC-11, AC-12)

1. Select the Rectangle tool.
2. Hold `Space` — cursor should change to a grab hand.
3. Drag — canvas should pan; no rectangle should appear.
4. Release `Space` — cursor returns to Rectangle tool cursor; no shape drawn.
5. Click into a text `<input>` on the page, then hold `Space` — NO pan; space character typed.

Expected: temporary pan; original tool restored on Space release; suppressed in text input.

## Running unit tests

```bash
pnpm test              # all tests
pnpm test camera       # camera.store + camera util tests only
```

AC coverage check (after Phase 5):
```bash
bash scripts/check-ac-coverage.sh
```
