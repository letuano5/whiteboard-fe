# Implementation Plan: P1A-02 Select Shape (angle = 0)

**Branch**: `feat/local-editor` | **Date**: 2026-06-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-select-shape/spec.md`

## Summary

Implement click-to-select for shapes on the whiteboard canvas (angle = 0 only). When the select
tool is active, clicking a shape performs a hit-test against all visible elements (preferring
highest `zIndex`), stores the result in `interactionStore.selectedIds`, and renders a visual
bounding-box overlay with 8 resize handles inside the SvgLayer. Clicking empty canvas clears
selection. No element mutations — selection is purely transient state.

## Technical Context

**Language/Version**: TypeScript 6.x strict, React 19.x, Node 22 LTS

**Primary Dependencies**: Zustand 5 (state), SVG (rendering), Vite 8 (bundler)

**Storage**: N/A for this feature — selection is transient, never persisted

**Testing**: Vitest 4.x + @testing-library/react

**Target Platform**: Browser (modern, desktop)

**Project Type**: Single-repo frontend web application

**Performance Goals**: Visual selection response ≤1 frame (≤16ms) at 60fps; hit-test O(n) where n = number of visible elements (hundreds max in P1A)

**Constraints**: No `any` types. No new packages. angle = 0 only (no rotation hit-test). Selection state lives in `interaction.store.ts` exclusively.

**Scale/Scope**: P1A scope — offline, single tab, ≤hundreds of elements

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Unified Element Store — renderer holds no state | ✅ | Selection overlay reads `selectedIds` from `interactionStore`; renderer derives display from store only |
| II | Element Versioning — `version++`, new `versionNonce`, `updatedAt` on every mutate | ✅ (N/A) | No element mutations in this feature; selection is transient |
| III | Shared Camera Transform — all layers use `camera.store.ts` + `screenToWorld`/`worldToScreen` | ✅ | Pointer coordinates converted via `screenToWorld`; overlay rendered in SVG camera-transform group |
| IV | ShapeUtil Strategy — no type branching in core; new shape = new ShapeUtil only | ✅ | `hitTest` logic lives in each `ShapeUtil`; select-tool calls `shapeUtil.hitTest()` — zero type branching in core |
| V | Sync Data Not Renderer — only `Element[]` crosses boundaries | ✅ (N/A) | No sync in this feature; `selectedIds` is transient and never broadcast |
| VI | Single Mutation Pipeline — `createElement`/`patchElement`/`deleteElements`/`updateElements` only | ✅ (N/A) | No element mutations; only `interactionStore.setSelectedIds()` is called |
| VII | Committed vs Transient State — `elements.store` and `interaction.store` stay separate | ✅ | `selectedIds` written only to `interaction.store.ts` |

**Verdict: All principles satisfied. No violations.**

## Project Structure

### Documentation (this feature)

```text
specs/001-select-shape/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # /speckit-tasks output
```

### Source Code (new/modified files)

```text
src/
├── canvas/
│   ├── tools/
│   │   └── select-tool.ts           [NEW] hit-test + select logic
│   ├── layers/
│   │   └── SvgLayer.tsx             [MODIFY] add SelectionOverlay inside camera-transform group
│   └── Whiteboard.tsx               [MODIFY] route pointer events to select-tool when tool==='select'
├── canvas/shapes/
│   ├── rectangle.tsx                [MODIFY] implement hitTest (AABB)
│   ├── ellipse.tsx                  [MODIFY] implement hitTest (AABB)
│   ├── line.tsx                     [MODIFY] implement hitTest (point-to-segment distance)
│   ├── text.tsx                     [MODIFY] implement hitTest (AABB)
│   └── diamond.tsx                  [MODIFY] implement hitTest (AABB — diamond bbox)
└── canvas/shapes/__tests__/
    └── shapes.test.tsx              [MODIFY] add hitTest test cases

src/canvas/tools/__tests__/
└── select-tool.test.ts              [NEW] unit tests for select-tool logic
```

## Complexity Tracking

> No constitution violations. Table left empty.

---

## Phase 0: Research

No external unknowns. All technology choices (React SVG, Zustand 5, TypeScript) are documented
in `CLAUDE.md` and the constitution. This section records design decisions made prior to coding.

**Decision 1 — Hit-test strategy (angle=0)**

| Shape | Method | Rationale |
|-------|--------|-----------|
| rectangle, ellipse, text, diamond | AABB containment: `x ≤ px ≤ x+w AND y ≤ py ≤ y+h` | Correct at angle=0; fast O(1); matches spec assumption |
| line | Point-to-segment distance ≤ 8 world units | Lines have zero-width bbox; AABB would be unusable for near-horizontal or near-vertical lines |

**Decision 2 — z-order hit priority**

Sort non-deleted elements by `zIndex` descending, then iterate; return the first element whose
`hitTest` returns `true`. This guarantees higher `zIndex` wins when shapes overlap, matching
FR-003 and AC-2.

**Decision 3 — Selection overlay placement**

Render the overlay inside the SVG camera-transform `<g>` group (same as shapes), so that
bounding box + handles automatically follow camera pan/zoom without extra coordinate math.
The overlay `<g>` is placed after all shape `<g>` nodes so it renders on top.

**Decision 4 — Handle rendering**

8 small `<circle>` elements (radius=4 world units) at positions:
- nw: (x, y), ne: (x+w, y), sw: (x, y+h), se: (x+w, y+h)
- n: (x+w/2, y), s: (x+w/2, y+h), e: (x+w, y+h/2), w: (x, y+h/2)

Handles are visual-only in P1A-02 (not interactive; resize is P1A-03).

**Decision 5 — No pointer capture for select-tool on pointerdown**

Unlike create-shape-tool (which captures the pointer to track drag), select-tool only needs a
`pointerdown` event to pick a shape. No drag tracking is needed in P1A-02 (move/resize is P1A-03).

---

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](./data-model.md).

### Quickstart Validation

See [quickstart.md](./quickstart.md).
