# Implementation Plan: P1B-03 Inline Text Editing (Double-click + Auto-bbox)

**Branch**: `feat/local-editor` | **Date**: 2026-06-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-inline-text-edit/spec.md`

## Summary

Enable users to double-click any `text`-type element to open an inline `contenteditable` editor overlay. On blur or Escape, the edited content is committed to `props.text` via `patchElement`, and the element's bounding box is auto-sized to match the rendered text dimensions. `editingId` (transient state) tracks which element is open for editing.

## Technical Context

**Language/Version**: TypeScript 6.x, strict mode

**Primary Dependencies**: React 19, Zustand 5.x, Vite 8.x

**Storage**: N/A (no new persistence; `patchElement` already persists via mutation hooks)

**Testing**: Vitest 4.x

**Target Platform**: Browser (SVG-first canvas rendering)

**Project Type**: Web application (single-page)

**Performance Goals**: Editor opens within one animation frame of double-click; no perceptible delay

**Constraints**: No `any`; no direct store writes outside mutation pipeline; editor must work at all zoom levels

**Scale/Scope**: Single-user editing of `text` elements on the canvas

## Constitution Check

*GATE: Must pass before implementation. Re-checked after design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Unified Element Store — renderer holds no state | ✅ | `TextEditor` reads element from `elements.store`; no extra derived state cached |
| II | Element Versioning — `version++`, new `versionNonce`, `updatedAt` on every mutate | ✅ | All commits go through `patchElement` which increments version automatically |
| III | Shared Camera Transform — all layers use `camera.store.ts` + `screenToWorld`/`worldToScreen` | ✅ | Editor overlay positioned using `camera.store.ts` values for zoom/pan |
| IV | ShapeUtil Strategy — no type branching in core; new shape = new ShapeUtil only | ✅ | `SvgLayer.tsx` filters by `editingId`; no type-branching added to core |
| V | Sync Data Not Renderer — only `Element[]` crosses boundaries | ✅ | `editingId` is transient; never enters mutation pipeline or sync layer |
| VI | Single Mutation Pipeline — `createElement`/`patchElement`/`deleteElements`/`updateElements` only | ✅ | Commit uses `patchElement(id, { props: { text }, width, height })` |
| VII | Committed vs Transient State — `elements.store` and `interaction.store` stay separate | ✅ | `editingId` lives in `interaction.store` only |

No violations.

## Project Structure

### Documentation (this feature)

```text
specs/009-inline-text-edit/
├── plan.md              ← this file (research inlined under ## Research)
├── spec.md
├── acceptance.md
├── data-model.md
├── quickstart.md
└── tasks.md
```

### Source Code Changes

```text
src/
├── types/
│   └── interaction.ts          MODIFY: add `editingId: string | null`
├── store/
│   └── interaction.store.ts    MODIFY: add `editingId`, `setEditingId`
├── canvas/
│   ├── Whiteboard.tsx          MODIFY: add onDoubleClick + render <TextEditor>
│   ├── layers/
│   │   └── SvgLayer.tsx        MODIFY: hide element being edited (opacity 0)
│   └── tools/
│       └── text-editor.tsx     CREATE: TextEditor component

src/canvas/tools/__tests__/
│   └── text-editor.test.tsx    CREATE: unit tests

```

## Design Decisions

### A. Editor Overlay Architecture

The editor is a `<div contenteditable>` rendered by a `TextEditor` React component. It is a sibling of `<SvgLayer>` inside `Whiteboard.tsx`, positioned absolutely to overlay the SVG:

```
<div containerRef> (position: relative)
  <SvgLayer />           ← SVG; text element hidden when editing
  <TextEditor />         ← absolute div; shown when editingId !== null
  <Toolbar />
  <DetailPanel />
  <BackToContent />
</div>
```

This avoids inserting DOM elements inside SVG (not valid), keeps the editor in the normal React rendering tree, and reuses the existing `containerRef` for absolute positioning.

### B. Editor Positioning

Given element in world coordinates `(el.x, el.y, el.width, el.height, el.angle)` and camera `{ x, y, zoom }`:

```
screenLeft = (el.x - camera.x) * zoom
screenTop  = (el.y - camera.y) * zoom
screenW    = el.width  * zoom
screenH    = el.height * zoom
fontSize   = (el.props.fontSize ?? 16) * zoom

transform-origin: {screenW/2}px {screenH/2}px
transform: rotate({el.angle * 180/π}deg)
```

The div is positioned at `(screenLeft, screenTop)` and rotated around its center to match the SVG `rotate(deg cx cy)` transform.

### C. Hiding the SVG Text While Editing

In `SvgLayer.tsx`, when rendering the list of visible elements, any element whose `id === editingId` is rendered with `opacity={0}` (not skipped entirely, to keep DOM stability and hit-test geometry intact). This is the only place `editingId` affects the SVG layer — no type branching is added to `ShapeUtil`.

### D. Commit & Auto-bbox

On commit (blur or Escape):
1. Read `innerText` from the `contenteditable` div.
2. Read `scrollWidth` and `scrollHeight` from the div to measure rendered size.
3. Convert screen dimensions back to world: `worldW = scrollWidth / zoom`, `worldH = scrollHeight / zoom`.
4. Call `patchElement(editingId, { props: { ...el.props, text: innerText }, width: worldW, height: worldH })`.
5. Set `editingId = null` to close the editor.

Using `scrollWidth/scrollHeight` gives the natural content dimensions of the editor at the current zoom font size, then dividing by zoom converts to world coordinates.

### E. Double-click Detection

Add `onDoubleClick` handler on the `<svg>` in `SvgLayer.tsx` props (passing it from `Whiteboard.tsx`). The handler mirrors `handlePointerDown`: convert to world coords, hit-test elements, and if the hit element is `type === 'text'`, open the editor via `setEditingId(el.id)`.

### F. Keyboard & Focus Management

- The `TextEditor` component calls `divRef.current?.focus()` on mount.
- `onKeyDown` in `TextEditor`: if `key === 'Escape'`, call commit + `setEditingId(null)`.
- `onBlur` in `TextEditor`: call commit + `setEditingId(null)`.
- Guard against double-commit: use a `committed` ref flag so blur after Escape is a no-op.

### G. EditingId in InteractionState

```ts
// interaction.ts
export interface InteractionState {
  ...
  editingId: string | null;   // ← NEW
}

// interaction.store.ts
setEditingId: (id: string | null) => void;  // ← NEW
```

## Complexity Tracking

> No constitution violations.

---

## Research

*Phase 0 findings — all NEEDS CLARIFICATION resolved.*

**contenteditable in React**: React 19 renders `contenteditable` divs normally. Use `ref.current.innerText` to read content (not `innerHTML`). Set initial content via `useEffect` after mount: `ref.current.innerText = el.props.text ?? ''`. Do NOT use `value` or `dangerouslySetInnerHTML` — they fight React's reconciler with contenteditable. The `onInput` event (not `onChange`) is the correct React event for contenteditable.

**scrollWidth/scrollHeight measurement**: The div needs `white-space: pre-wrap; word-break: break-word` and `min-width: 1ch` to allow natural sizing. `scrollWidth` gives the minimum width needed; `scrollHeight` gives the natural height. Read these in the `onBlur`/`onKeyDown` handler BEFORE clearing focus.

**CSS rotation matching SVG rotation**: SVG `rotate(θ cx cy)` is equivalent to CSS `transform-origin: ${cx - left}px ${cy - top}px; transform: rotate(θdeg)`. Since the div is positioned at `(el.x - camera.x) * zoom, (el.y - camera.y) * zoom`, the center offset is `(el.width * zoom / 2, el.height * zoom / 2)`.

**Decisions**:
- Enter = newline (natural contenteditable behavior); no "confirm on Enter" shortcut
- Escape = commit (not discard), per spec
- Empty text → keep element (no auto-delete)
