# Quickstart Validation Guide: localStorage Persistence & Z-Order Foundation

**Date**: 2026-06-24

## Prerequisites

- Dev server running: `pnpm dev`
- Browser DevTools open (Application → Storage → Local Storage)

## P1A-09: localStorage Persistence Validation

### Scenario 1 — Basic persist + restore (AC-1, AC-2)

1. Open `http://localhost:5173`
2. Select Rectangle tool, draw a shape
3. In DevTools, check `VDT_WHITEBOARD_SCENE` key exists in localStorage (wait ~300 ms)
4. Pan and zoom the canvas
5. Reload the page
6. **Expected**: Shape reappears at the same position/size/style; camera matches pre-reload viewport

### Scenario 2 — Deleted element not restored (AC-3)

1. Draw a shape, wait ~300 ms
2. Select it and press Delete
3. Wait ~300 ms; reload
4. **Expected**: Deleted shape does not appear on canvas

### Scenario 3 — Fresh start (AC-5)

1. In DevTools, clear the `VDT_WHITEBOARD_SCENE` key (or open an incognito tab)
2. Load the app
3. **Expected**: Canvas starts empty, no errors in console

### Scenario 4 — Corrupted data (AC-6)

1. In DevTools, set `VDT_WHITEBOARD_SCENE` to `{invalid json`
2. Reload
3. **Expected**: Canvas starts empty, no errors in console

## P1A-10: Z-Order Validation

### Scenario 5 — Render stacking (AC-8)

1. Draw a red rectangle (shape A)
2. Draw a blue rectangle overlapping A (shape B)
3. **Expected**: Blue rectangle (B) appears on top of red (A) in the overlap area

### Scenario 6 — Hit-test priority (AC-9)

1. Draw shape A (any color), then draw shape B overlapping A
2. Click directly on the overlapping region
3. **Expected**: Shape B is selected (selection handles appear around B, not A)

### Scenario 7 — zIndex assignment (AC-10, AC-11)

1. On an empty canvas, draw the first shape
2. Open DevTools, check `VDT_WHITEBOARD_SCENE` → elements[0].zIndex
3. **Expected**: zIndex === 1
4. Draw a second shape; **Expected**: second element's zIndex === 2

## Running Tests

```bash
pnpm test                          # all tests
pnpm test local-storage            # P1A-09 unit tests only
pnpm test mutation-pipeline        # P1A-10 zIndex assignment tests
pnpm test select-tool              # P1A-10 hit-test priority tests
pnpm test SvgLayer                 # P1A-10 render order tests
```

All AC-1 through AC-11 must have at least one passing `@covers AC-n` test.
