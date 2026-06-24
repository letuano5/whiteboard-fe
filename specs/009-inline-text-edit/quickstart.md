# Quickstart Validation Guide — P1B-03 Inline Text Editing

## Prerequisites

- Dev server running: `pnpm dev`
- Browser open at `http://localhost:5173`

## Scenario 1 — Edit existing text element (AC-1, AC-2, AC-4)

1. Select the **Text tool** from the toolbar.
2. Click anywhere on the canvas to create a text element (default text "Text").
3. Switch to the **Select tool**.
4. Double-click the text element.
5. **Expected**: An inline editor appears at the element's position. The original SVG text is hidden.
6. Type "Hello World".
7. Click anywhere outside the editor.
8. **Expected**: The element now displays "Hello World". Its bounding box matches the width/height of "Hello World" at the configured font size.

## Scenario 2 — Commit with Escape (AC-3)

1. Double-click a text element.
2. Type "Escape Test".
3. Press **Escape**.
4. **Expected**: Editor closes. Element shows "Escape Test" with auto-sized bbox.

## Scenario 3 — Zoom + edit (AC-5)

1. Zoom in to 200% (Ctrl+scroll or pinch).
2. Double-click a text element.
3. **Expected**: Editor appears at the zoomed position with font size scaled proportionally.
4. Type text and blur.
5. **Expected**: Element bbox in world coordinates is correctly auto-sized (same world size regardless of zoom when viewed at 100%).

## Scenario 4 — Empty text (AC-6)

1. Double-click a text element.
2. Select all (Ctrl+A) and delete.
3. Click outside.
4. **Expected**: Element remains on canvas with empty text. No crash, no deletion.

## Scenario 5 — Non-text element (AC-7)

1. Create a rectangle.
2. Double-click it.
3. **Expected**: No inline editor appears.

## Scenario 6 — editingId lifecycle (AC-8)

Verify via React DevTools / Zustand store:
- Before double-click: `interaction.editingId === null`
- After double-click on text element: `interaction.editingId === <element.id>`
- After blur/Escape: `interaction.editingId === null`

## Run Tests

```bash
pnpm test
```

All tests in `src/canvas/tools/__tests__/text-editor.test.tsx` must pass.
