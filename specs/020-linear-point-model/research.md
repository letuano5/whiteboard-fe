# Research: Point-Based Model for Linear Elements

**Date**: 2026-06-29
**Status**: Complete — no external APIs or new libraries required

## Findings

### Decision: No new dependencies
**Rationale**: The feature is entirely self-contained in the frontend. It restructures how
existing data is derived and displayed — it requires no network calls, no new packages,
and no migration scripts.

**Alternatives considered**: None applicable.

---

### Decision: `normalizeLinearBounds` lives in `frontend/src/utils/geometry.ts`
**Rationale**: It is a pure geometry function (no imports beyond `[number, number][]`).
Placing it in `geometry.ts` (not `canvas/shapes/utils.ts`) avoids creating a
store → canvas dependency when `mutation-pipeline.ts` imports it.

**Alternatives considered**:
- `canvas/shapes/utils.ts` — rejected: creates store layer import from canvas layer
- Inline in mutation-pipeline — rejected: not reusable by ShapeUtil `getBounds`

---

### Decision: Endpoint handle IDs are `'ep-start'` and `'ep-end'` (not `'start'/'end'`)
**Rationale**: Avoids collision with any future handle names. Keeps `ResizeHandleId`
unchanged (still 8 bbox handles) so all existing resize logic is unaffected.
`HandleId` union grows by two members; `InteractionState.resizeHandle` widens from
`ResizeHandleId | null` to `HandleId | null`.

**Alternatives considered**:
- Index-based (`0`, `1`) — rejected: not a string-based `HandleId` type
- Separate `endpointDragSession` in interaction state — rejected: more surface area;
  `resizeHandle` already tracks "which handle is active"

---

### Decision: Bound-arrow real-time follow uses `draftElements` during single-element drag
**Rationale**: `draftElements` is already rendered in `SvgLayer.tsx` and its elements are
hidden from the committed layer. Adding bound arrows to `draftElements` during a single-
element drag gives the desired visual follow-along with minimal new state.

`onSelectPointerUp` is adjusted: when both `draftElement` (the main element) and
`draftElements` (bound arrows) are present, it commits `draftElements` first then
falls through to commit `draftElement`. The existing multi-drag early return is kept
for the pure multi-drag case (`!draftElement` guard).

**Alternatives considered**:
- New `boundArrowDrafts` state field — rejected: duplicates functionality already in `draftElements`
- Commit arrows on pointer-up only (no draft) — rejected: violates the spec requirement
  that arrows follow "in real-time during drag, not only on pointer-up"

---

### Codebase observations (from source inspection)

- `arrow.tsx` `getBounds` returns `{ x, y, width, height }` from element directly (bug target).
- `line.tsx` `getBounds` same issue.
- `arrow.tsx` `render` and `hitTest` already prefer `props.points` over bbox — good.
- `select-tool.ts` `onSelectPointerUp` already has snap-binding logic for arrow resize;
  endpoint-handle drag can reuse this path with no changes to the snap logic.
- `SvgLayer.tsx` `SelectionOverlay` renders 8 bbox handles for all element types.
- Existing `onSelectPointerMove` single-drag path calls `setDraftElement` but does not
  currently call `setDraftElements` — adding bound arrows there requires also clearing
  `draftElements` at the end of single-element drag in `onSelectPointerUp`.
