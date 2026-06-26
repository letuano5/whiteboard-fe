# Implementation Plan: Basic Style Panel & Text Properties (P1A-04 + P1A-05)

**Branch**: `feat/local-editor` | **Date**: 2026-06-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-style-and-text/spec.md`

## Summary

Build a `DetailPanel` React component that reads the currently selected element from the Zustand stores and exposes editable controls for all visual style properties (`strokeColor`, `fillColor`, `strokeWidth`, `opacity`) plus text-specific properties (`fontSize`, `fontFamily`, `textAlign`) when a `text` element is selected. Every change goes through `patchElement` — the single mutation pipeline — so versioning, history, and future broadcast are handled automatically.

Also fix the text `ShapeUtil` so the SVG `x` coordinate anchors correctly to the element's bounding box based on `textAlign` (left edge / center / right edge).

## Technical Context

**Language/Version**: TypeScript 6.x, strict mode

**Primary Dependencies**: React 19, Zustand 5.x, Tailwind CSS 4.x

**Storage**: Zustand in-memory committed store (`elements.store.ts`), no DB writes in P1A

**Testing**: Vitest 4.x + React Testing Library

**Target Platform**: Web browser (Chrome/Firefox/Safari), SVG/DOM rendering

**Project Type**: Web application (frontend only in this phase)

**Performance Goals**: Style change visible within the same interaction frame (≤16ms render cycle)

**Constraints**: No Canvas, no new external packages; use native HTML form inputs

**Scale/Scope**: Single selected element at a time (multi-select deferred to P2)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Unified Element Store — renderer holds no state | ✅ | DetailPanel reads from stores, holds no local element state between renders |
| II | Element Versioning — `version++`, new `versionNonce`, `updatedAt` on every mutate | ✅ | All changes go through `patchElement` which handles versioning |
| III | Shared Camera Transform — all layers use `camera.store.ts` | ✅ | DetailPanel is UI overlay, not a rendering layer; camera not involved |
| IV | ShapeUtil Strategy — no type branching in core | ✅ | Type check (`element.type === 'text'`) lives ONLY in DetailPanel UI, not in core/pipeline |
| V | Sync Data Not Renderer — only `Element[]` crosses boundaries | ✅ | `patchElement` stores Element data; no renderer state is serialized |
| VI | Single Mutation Pipeline — `patchElement` only | ✅ | DetailPanel calls `patchElement`; no direct store writes |
| VII | Committed vs Transient — stores stay separate | ✅ | `selectedIds` stays in `interaction.store`; element data in `elements.store` |

## Project Structure

### Documentation (this feature)

```text
specs/003-style-and-text/
├── plan.md              # This file
├── spec.md              # Feature specification
├── acceptance.md        # AC registry (AC-1 through AC-16)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # /speckit-tasks output
```

### Source Code

```text
src/
├── components/
│   └── detail-panel/
│       └── DetailPanel.tsx        ← NEW: main panel component
├── canvas/
│   ├── Whiteboard.tsx             ← EDIT: import + render DetailPanel
│   └── shapes/
│       └── text.tsx               ← EDIT: fix x-anchor for textAlign
└── [all other files unchanged]
```

## Complexity Tracking

> No Constitution violations. Table empty.

---

## Phase 0: Research

### No external unknowns

All technology choices are already established in CLAUDE.md and the existing codebase:
- Zustand 5 store API (`useElementsStore`, `useInteractionStore`): already in use
- `patchElement` signature: `patchElement(id, { props: { ...existing, newProp } })`
- Tailwind CSS 4 for styling: already in use across Toolbar
- Native HTML inputs (`<input type="color">`, `<input type="range">`, `<input type="number">`, `<select>`): no research needed

### One design decision to capture

**Text SVG anchor point for `textAlign`:**

The current `text.tsx` renders with a fixed `x={element.x}` regardless of `textAlign`, then sets `textAnchor` to `start`/`middle`/`end`. This is broken: `textAnchor='middle'` anchors relative to the given `x`, so when `x = element.x` (left edge), "center" and "right" alignment do not center/right-align within the bounding box.

**Fix**: compute the SVG `x` attribute from `textAlign`:
```
textAlign 'left'   → x = element.x               (textAnchor='start')
textAlign 'center' → x = element.x + width/2      (textAnchor='middle')
textAlign 'right'  → x = element.x + width        (textAnchor='end')
```

This is the correct SVG pattern: anchor point = the intended text origin, textAnchor describes which part of the text sits at that point.

---

## Phase 1: Design & Contracts

### data-model.md (see file)

No new data model changes — all fields already exist in `ElementProps`. DetailPanel reads and writes existing fields only.

### Component contract: DetailPanel

**Props**: none (reads from stores directly)

**Behavior**:
- Reads `selectedIds` from `useInteractionStore`
- If `selectedIds.length !== 1`: renders `null`
- Reads the element matching `selectedIds[0]` from `useElementsStore`
- If element not found or `isDeleted`: renders `null`
- Renders a floating panel (position: fixed, right side) with:
  - Section "Style": strokeColor (color input), fillColor (color input, hidden for `line`), strokeWidth (number input, min=1), opacity (range 0–100)
  - Section "Text" (only when `element.type === 'text'`): fontSize (number input, min=1), fontFamily (select: sans-serif/serif/monospace), textAlign (3 toggle buttons: L/C/R)
- Each control's `onChange`: calls `patchElement(element.id, { props: { ...element.props, changedField: newValue } })`

**Positioning**: `position: fixed; top: 50%; right: 16px; transform: translateY(-50%)` — overlays on the right side, vertically centered, does not push canvas content.

### quickstart.md (see file)

---

## Implementation Tasks (summary — detail in tasks.md)

### T-1: Fix text ShapeUtil x-anchor

File: `src/canvas/shapes/text.tsx`

Replace the hardcoded `x={x}` with:
```ts
const textX =
  props.textAlign === 'center' ? x + element.width / 2
  : props.textAlign === 'right' ? x + element.width
  : x;
```
And pass `x={textX}` to the SVG `<text>` element.

### T-2: Build DetailPanel component

File: `src/components/detail-panel/DetailPanel.tsx`

```tsx
import { useInteractionStore } from '../../store/interaction.store';
import { useElementsStore } from '../../store/elements.store';
import { patchElement } from '../../store/mutation-pipeline';

export default function DetailPanel() {
  const selectedIds = useInteractionStore((s) => s.selectedIds);
  const elements = useElementsStore((s) => s.elements);

  if (selectedIds.length !== 1) return null;
  const element = elements.find((e) => e.id === selectedIds[0] && !e.isDeleted);
  if (!element) return null;

  const { props } = element;

  function patch(partial: Partial<typeof props>) {
    patchElement(element!.id, { props: { ...props, ...partial } });
  }

  return (
    <div style={{ position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)', ...panelStyles }}>
      {/* Style section */}
      <label>Stroke color <input type="color" value={props.strokeColor} onChange={e => patch({ strokeColor: e.target.value })} /></label>
      {element.type !== 'line' && (
        <label>Fill color <input type="color" value={props.fillColor} onChange={e => patch({ fillColor: e.target.value })} /></label>
      )}
      <label>Stroke width <input type="number" min={1} value={props.strokeWidth} onChange={e => patch({ strokeWidth: Number(e.target.value) })} /></label>
      <label>Opacity <input type="range" min={0} max={100} value={Math.round(props.opacity * 100)} onChange={e => patch({ opacity: Number(e.target.value) / 100 })} /></label>

      {/* Text section */}
      {element.type === 'text' && (
        <>
          <label>Font size <input type="number" min={1} value={props.fontSize ?? 16} onChange={e => patch({ fontSize: Number(e.target.value) })} /></label>
          <label>Font family
            <select value={props.fontFamily ?? 'sans-serif'} onChange={e => patch({ fontFamily: e.target.value })}>
              <option value="sans-serif">Sans-serif</option>
              <option value="serif">Serif</option>
              <option value="monospace">Monospace</option>
            </select>
          </label>
          <div>
            {(['left','center','right'] as const).map(align => (
              <button key={align} onClick={() => patch({ textAlign: align })}>{align[0].toUpperCase()}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

Actual implementation will use Tailwind classes, not inline style objects (except for position).

### T-3: Wire DetailPanel into Whiteboard

File: `src/canvas/Whiteboard.tsx`

Import `DetailPanel` and render it inside the root `<div>` alongside `SvgLayer` and `Toolbar`.

### T-4: Tests

- `DetailPanel` unit tests (React Testing Library): AC-1 through AC-16
- `text.tsx` textAlign fix tests: textX computation for all three alignment values
