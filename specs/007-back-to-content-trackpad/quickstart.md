# Quickstart Validation Guide: Back to Content & Trackpad Support

## Prerequisites

```bash
cd frontend
pnpm dev     # start dev server
```

## Scenario 1 — Back to content button (AC-1 through AC-5)

1. Draw at least one shape on the canvas.
2. Pan far away (hold Space + drag, or use middle mouse button) until no shapes are visible.
3. **Expected**: A "Back to content" button appears near the bottom-center of the canvas, directly above the toolbar with a small gap and no overlap.
4. Click the button.
5. **Expected**: The camera moves so all shapes are visible with padding; no shape is cropped.
6. Delete all shapes. Pan to an empty area.
7. **Expected**: The "Back to content" button does NOT appear (no content).

## Scenario 2 — At least one shape visible (AC-2)

1. Draw shapes on canvas.
2. Pan so that at least one shape is partially on screen.
3. **Expected**: The "Back to content" button is NOT shown.

## Scenario 3 — Trackpad two-finger pan (AC-6, AC-7)

> Requires a trackpad device.

1. Without pressing Ctrl/Cmd, perform a two-finger scroll on the canvas.
2. **Expected**: The canvas pans in the scroll direction. Zoom level does not change.
3. Hold Ctrl (or Cmd on Mac) and scroll.
4. **Expected**: The canvas zooms; it does not pan.

## Scenario 4 — Trackpad pinch zoom smoothness (AC-8, AC-9)

> Requires a trackpad device.

1. Perform a slow pinch-to-zoom gesture on the canvas.
2. **Expected**: Zoom changes gradually and smoothly — no large jumps.
3. Zoom all the way in or out.
4. **Expected**: Zoom stops at 8× (max) or 0.1× (min) — no clamping violation.

## Scenario 5 — Select mode hint (AC-10, AC-11)

1. Ensure the Select tool is active (toolbar shows Select highlighted).
2. **Expected**: A small hint text "Click chuột giữa để scroll canvas" appears on the canvas.
3. Click the Pan/Hand tool.
4. **Expected**: The hint text disappears.

## Running tests

```bash
pnpm test                   # run all tests
pnpm test:coverage          # with coverage report
```

Key test files:
- `src/utils/camera.test.ts` — unit tests for `getContentBounds`, `isAnyElementVisible`, `fitToContent`
- `src/canvas/__tests__/zoom-pan.test.ts` — wheel event dispatch tests
- `src/components/back-to-content/__tests__/BackToContent.test.tsx` — button visibility/click tests
