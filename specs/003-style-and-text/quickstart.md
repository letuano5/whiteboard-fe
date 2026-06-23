# Quickstart Validation Guide: Basic Style Panel & Text Properties

## Prerequisites

- `pnpm dev` running (Vite dev server)
- Browser open at `http://localhost:5173`

## Scenario 1 — Edit stroke color (AC-3)

1. Select the **Rectangle** tool, draw a shape.
2. Switch to **Select** tool, click the shape to select it.
3. In the right-side detail panel, click the stroke color swatch and pick red (`#ff0000`).
4. **Expected**: rectangle outline turns red immediately.

## Scenario 2 — Edit fill color (AC-4)

1. Select a rectangle.
2. In the panel, pick blue (`#0000ff`) for fill color.
3. **Expected**: rectangle interior turns blue immediately.

## Scenario 3 — Edit opacity (AC-6)

1. Select a shape.
2. Drag the opacity slider from 100 to 50.
3. **Expected**: shape becomes 50% transparent.

## Scenario 4 — Panel hidden when nothing selected (AC-2)

1. Click empty canvas to deselect all.
2. **Expected**: the detail panel disappears entirely.

## Scenario 5 — Text properties (AC-9, AC-11, AC-12, AC-14)

1. Select the **Text** tool, draw a text box and type "Hello".
2. Switch to **Select**, click the text element.
3. **Expected**: panel shows font size, font family, and alignment buttons (in addition to style controls).
4. Change font size to 32. **Expected**: "Hello" appears larger immediately.
5. Change font family to "Monospace". **Expected**: font changes immediately.
6. Click "C" (center alignment). **Expected**: text centered within its bounding box.

## Scenario 6 — Non-text shape hides text controls (AC-10)

1. Select a rectangle.
2. **Expected**: panel does NOT show font size, font family, or alignment buttons.

## Test commands

```bash
pnpm test           # run all unit tests
pnpm typecheck      # ensure no TypeScript errors
pnpm lint           # ensure no ESLint errors
```

Expected: all tests pass, 0 TypeScript errors, 0 lint errors.
