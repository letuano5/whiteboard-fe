# Implementation Plan: P1A-03 Move / Resize / Delete

**Branch**: `feat/local-editor` | **Date**: 2026-06-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-move-resize-delete/spec.md`

## Summary

Extend the existing select-tool (P1A-02) so that a selected shape can be **moved** by
dragging its body, **resized** by dragging any of its 8 handles, and **deleted** with
Del/Backspace. All mutations go through `patchElement` / `deleteElements`. Drag state is
transient (interaction store only). Angle = 0 throughout P1A.

## Technical Context

**Language/Version**: TypeScript 6.x strict, React 19.x, Node 22 LTS

**Primary Dependencies**: Zustand 5 (transient drag state), SVG (interactive handles), Vite 8

**Storage**: N/A for this feature — drag state is transient; mutations land in `elements.store` via the pipeline

**Testing**: Vitest 4.x; pure function tests for select-tool logic (no DOM/React required for unit layer)

**Target Platform**: Browser (modern, desktop)

**Project Type**: Single-repo frontend web application

**Performance Goals**: Move/resize visual response ≤1 frame (≤16ms) at 60fps; delta math is O(1)

**Constraints**: No `any` types. No new packages. angle = 0 only. Transient drag state in `interaction.store.ts` exclusively. Pointer capture required for all drag operations.

**Scale/Scope**: P1A scope — offline, single tab, ≤hundreds of elements

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Unified Element Store — renderer holds no state | ✅ | Drag position is transient in interaction store; only final x/y/w/h land in elements.store via patchElement |
| II | Element Versioning — `version++`, new `versionNonce`, `updatedAt` on every mutate | ✅ | patchElement handles versioning; called on pointerup (commit) |
| III | Shared Camera Transform — all layers use `camera.store.ts` + `screenToWorld`/`worldToScreen` | ✅ | Pointer events converted via `screenToWorld` before delta math |
| IV | ShapeUtil Strategy — no type branching in core; new shape = new ShapeUtil only | ✅ | Move/resize operates on bbox (x,y,w,h) — type-agnostic; ShapeUtil not invoked |
| V | Sync Data Not Renderer — only `Element[]` crosses boundaries | ✅ (N/A) | No sync in this feature; drag is transient |
| VI | Single Mutation Pipeline — `createElement`/`patchElement`/`deleteElements`/`updateElements` only | ✅ | Move → `patchElement({x,y})`; Resize → `patchElement({x,y,width,height})`; Delete → `deleteElements([id])` |
| VII | Committed vs Transient State — `elements.store` and `interaction.store` stay separate | ✅ | `dragStart`, `resizeHandle`, `draggingId` live in interaction store; committed element updated only on commit |

**Verdict: All principles satisfied. No violations.**

## Project Structure

### Documentation (this feature)

```text
specs/002-move-resize-delete/
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
│   │   └── select-tool.ts           [MODIFY] add move/resize/delete logic
│   ├── layers/
│   │   ├── SvgLayer.tsx             [MODIFY] make handles interactive; pass onHandlePointerDown
│   │   └── __tests__/
│   │       └── SvgLayer.test.tsx    [MODIFY] add AC-10 test (soft-deleted not rendered)
│   └── Whiteboard.tsx               [MODIFY] route pointerMove/pointerUp to select-tool; add keyboard handler
├── store/
│   └── interaction.store.ts         [MODIFY] add draggingId, dragStart, resizeHandle fields
└── canvas/tools/__tests__/
    └── select-tool.test.ts          [MODIFY] add move/resize/delete tests (AC-1..AC-9, AC-11..AC-12)
```

## Complexity Tracking

> No constitution violations. Table left empty.

---

## Phase 0: Research

No external unknowns. All technology choices documented in CLAUDE.md and the constitution.

**Decision 1 — Drag state fields in interaction store**

| Field | Type | Purpose |
|-------|------|---------|
| `draggingId` | `string \| null` | ID of element being moved/resized; `null` = not dragging |
| `dragStart` | `{ x: number; y: number } \| null` | World-space pointer position when drag began |
| `resizeHandle` | `HandleId \| null` | Which handle is active (`null` = body drag = move) |

These already appear as stubs in `src/types/interaction.ts` `InteractionState`. If they are already defined there but absent from the store, add them to the store only.

**Decision 2 — Live vs commit-only mutation**

Two options:
- **Option A (Live)**: Call `patchElement` on every `pointerMove` so the element in the store follows the pointer continuously.
- **Option B (Commit-only)**: Store delta in transient state, call `patchElement` once on `pointerUp`.

**Choice: Option B (Commit-only)** — rationale: avoids flooding the mutation pipeline (and the history) with thousands of intermediate patches during a single drag. The `draftElement` pattern from `create-shape-tool.ts` already shows this approach. A separate `draftElement` (or the existing `draftElement` field in interactionStore) can hold a live-preview copy of the element for the renderer to display during drag without mutating the committed store.

> **Correction**: SvgLayer already renders `draftElement` at 0.6 opacity if present. We will reuse this: set `draftElement` to the in-flight copy during move/resize; on `pointerUp`, call `patchElement` to commit, then clear `draftElement`.

**Decision 3 — Handle interactivity in SvgLayer**

Handles are `<circle>` elements inside the `SelectionOverlay`. To make them interactive:
- Add `onPointerDown` to each handle `<circle>` with `data-handle={id}` or directly pass `onHandlePointerDown: (handleId: HandleId, e: PointerEvent) => void` as a prop.
- Use `e.stopPropagation()` on handle pointerDown to prevent the body-drag handler on the SVG from firing simultaneously.

Chosen: pass `onHandlePointerDown` as a prop from `Whiteboard` → `SvgLayer` → `SelectionOverlay`.

**Decision 4 — Keyboard handler for Delete**

Add a `useEffect` in `Whiteboard.tsx` that registers a `keydown` listener on `window`. On `Delete`/`Backspace`, if `selectedIds.length > 0`, call `deleteElements(selectedIds)` then `setSelectedIds([])`.

**Decision 5 — Minimum size enforcement**

Clamp inside the resize delta computation (in `select-tool.ts`), not inside `patchElement`. This keeps `patchElement` a thin pipeline entry point and places UX constraints in the tool layer.

---

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](./data-model.md).

### Quickstart Validation

See [quickstart.md](./quickstart.md).
