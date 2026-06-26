# Quickstart Validation Guide: Detail Panel & Basic Toolbar

**Date**: 2026-06-24

## Prerequisites

- Node 22 LTS, pnpm 10
- `pnpm install` done

## Run the app

```bash
pnpm dev
# open http://localhost:5173
```

## Validation scenarios

### P1A-07: Detail Panel

1. **Panel hidden on load** — Open the whiteboard. The canvas is blank; no panel is visible on the right side.
2. **Panel appears on selection** — Click a rectangle or ellipse. A floating panel appears on the right showing: Stroke color, Fill color, Stroke width, Opacity.
3. **Realtime update** — With a shape selected, change the Stroke color via the color picker. The shape outline changes instantly with no save button.
4. **Panel hides on deselect** — Click empty canvas space. The panel disappears.
5. **Panel stays on panel click** — Select a shape; click inside the panel's number input for Stroke width. The shape remains selected and the panel stays visible.
6. **Text controls** — Create a text element (select Text tool, click canvas). Select it. The panel shows additional Font size, Font family, and Align controls. Change font size — the text resizes immediately.
7. **Multi-select hides panel** — (If marquee select is available) drag to select 2 shapes — panel disappears.

### P1A-08: Toolbar

1. **Toolbar visible** — Bottom-center of the canvas shows a toolbar with 6 buttons: Select (arrow), Hand, Rectangle, Ellipse, Line, Text.
2. **Active highlight** — Select tool (arrow) is highlighted blue by default. Click Rectangle — Rectangle becomes highlighted, Select is no longer highlighted.
3. **State clear** — Select a shape (it appears with a bounding box). Click Rectangle tool. The selection is cleared (bounding box disappears).

## Automated tests

```bash
pnpm test --run
# Expected: 196+ tests pass, 0 fail
```

Key test files:
- `src/components/detail-panel/__tests__/DetailPanel.test.tsx` — panel visibility, controls, patchElement calls
- `src/components/toolbar/__tests__/Toolbar.test.tsx` — tool switch, state clear
