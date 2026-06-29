# Tasks: Point-Based Model for Linear Elements

**Input**: Design documents from `specs/020-linear-point-model/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete sibling tasks)
- **[Story]**: Which user story this task belongs to ([US1]–[US5])
- Exact file paths are required in every description

---

## Phase 1: Setup

No project-level setup required — this is a pure refactor within the existing frontend
package. No new dependencies, config files, or directories to create before coding.

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: `normalizeLinearBounds` is the shared building block for every subsequent phase.
It must exist before `getBounds` fixes and pipeline normalization can be written.

**⚠️ CRITICAL**: All Phase 3–6 tasks depend on this function being in place.

- [ ] T001 Add pure function `normalizeLinearBounds(points: [number, number][]): { x: number; y: number; width: number; height: number }` to `frontend/src/utils/geometry.ts` — returns tight AABB; handles empty/single-point gracefully
- [ ] T002 [P] Create `frontend/src/utils/__tests__/linear-bounds.test.ts` with unit tests covering: (a) empty array → `{0,0,0,0}`, (b) single point → zero-size box, (c) two-point diagonal line → correct bbox, (d) horizontal line → height=0, (e) vertical line → width=0, (f) purity: input array is not mutated after the call, (g) non-linear guard: verify that calling `normalizeLinearBounds` on a non-arrow/non-line context returns the same pure computation (function has no type knowledge — this is implicitly correct since it is a pure function, but assert that a rectangle-shaped point cloud produces correct bbox to confirm no type-specific branching leaked in)

**Checkpoint**: `pnpm test` on geometry.ts passes → user story phases can now proceed

---

## Phase 3: US1 + US2 (Priority: P1) — Authoritative bounds from points 🎯 MVP

**Goal**: `getBounds` derives from `props.points`; every mutation keeps `x,y,width,height` in sync.
After this phase, selection boxes and hit-test regions are always correct.

**Independent test**: Draw an arrow; select it; verify the blue dashed selection box tightly
encloses both endpoints with no gap. (See `quickstart.md` Scenario 1.)

- [ ] T003 [US1] In `frontend/src/canvas/shapes/arrow.tsx`, update `arrowShapeUtil.getBounds` to call `normalizeLinearBounds(element.props.points)` when `props.points` has ≥ 2 entries; keep stored-bbox fallback for elements without points
- [ ] T004 [P] [US1] In `frontend/src/canvas/shapes/line.tsx`, update `lineShapeUtil.getBounds` with the same `normalizeLinearBounds` pattern as T003
- [ ] T005 [US2] In `frontend/src/store/mutation-pipeline.ts`: add private helper `applyLinearNorm(el: Element): Element` that calls `normalizeLinearBounds` and spreads the result onto `x,y,width,height` for `arrow`/`line` types; apply this helper in `createElement`, `createElements`, `patchElement`, and `updateElements` (after version bump, before store write / fireHooks)

---

## Phase 4: US3 (Priority: P2) — Endpoint handle interaction

**Goal**: Selecting an arrow or line shows 2 circular endpoint handles; dragging a handle
moves only that endpoint; snap binding fires on release.

**Depends on**: Phase 3 complete (endpoint handle positions derive from the now-correct `getBounds`)

**Independent test**: Select any arrow → exactly 2 handles visible. Drag end handle over a
shape → snap ring appears; release → arrow stays attached. (See `quickstart.md` Scenarios 2 & 3.)

- [ ] T006 In `frontend/src/types/interaction.ts`: (a) add `export type EndpointHandleId = 'ep-start' | 'ep-end';` (b) update `HandleId` union to `ResizeHandleId | 'rotate' | EndpointHandleId`; (c) widen `InteractionState.resizeHandle` from `ResizeHandleId | null` to `HandleId | null`; then in `frontend/src/store/interaction.store.ts` update the `setResizeHandle` action signature to match
- [ ] T007 [P] [US3] In `frontend/src/canvas/layers/SvgLayer.tsx`, update `SelectionOverlay`: when `element.type === 'arrow' || element.type === 'line'`, skip the 8 bbox handles and the rotate handle/line; instead render two circles (`r=5`, same blue style) at `element.props.points[0]` and `element.props.points[1]` (index 1, not last — linear elements always have exactly 2 points) with `data-handle="ep-start"` / `data-handle="ep-end"` and the same `onPointerDown` wiring
- [ ] T008 [US3] In `frontend/src/canvas/tools/select-tool.ts`, update `onSelectHandlePointerDown`: add guard at the top — if `handle === 'ep-start' || handle === 'ep-end'`, set `draggingId`, `dragStart`, `resizeHandle(handle)`, `resizeSession(null)` and return early (no resize session for endpoint drag)
- [ ] T009 [US3] In `frontend/src/canvas/tools/select-tool.ts`, update `onSelectPointerMove`: before the existing `resizeSession` branch, add an endpoint-drag branch — `if (resizeHandle === 'ep-start' || resizeHandle === 'ep-end')` → update only the corresponding index in a copy of `props.points`, compute new bbox with `normalizeLinearBounds`, and call `setDraftElement({ ...el, ...bbox, props: { ...el.props, points: newPoints } })`
- [ ] T010 [US3] In `frontend/src/canvas/tools/select-tool.ts`, update `onSelectPointerUp`: restructure the `draftElement` commit block so that arrow snap-binding logic is checked BEFORE `resizeSession` — specifically: when `draftElement.type === 'arrow' && draftElement.props.points`, detect the moved endpoint by comparing draft points vs original (existing algorithm), call `findNearestSnap` from `frontend/src/canvas/shapes/arrow-binding.ts` on the moved point, apply snap position and set/clear the appropriate binding (`startBinding` for `movedIdx=0`, `endBinding` for `movedIdx=last`); explicitly preserve the binding of the non-moved endpoint (if only start moved, leave `endBinding` untouched and vice versa); commit with `patchElement(draggingId, { x, y, width, height, props: resolvedProps })`; keep the original non-arrow resize path behind its `resizeSession` guard unchanged
- [ ] T011 [P] [US3] Create `frontend/src/canvas/tools/__tests__/endpoint-handle.test.ts` with unit tests covering: (a) `onSelectHandlePointerDown('ep-start')` sets `resizeHandle = 'ep-start'` and `resizeSession = null`; (b) `onSelectPointerMove` with `resizeHandle = 'ep-end'` updates `props.points[1]` to pointer position; (c) `onSelectPointerMove` with `resizeHandle = 'ep-start'` updates `props.points[0]` to pointer position; (d) AC-3: when endpoint is released over a target shape within snap threshold, `endBinding`/`startBinding` is set and the snap position is applied (delegates to existing `findNearestSnap` — verify it is called); (e) rendering assertion: mount `SelectionOverlay` with an arrow element and assert exactly 2 `circle` elements with `data-handle="ep-start"` / `data-handle="ep-end"` are rendered and no `data-handle="nw"` etc. exist (use `@testing-library/react` or Vitest DOM if available)

---

## Phase 5: US4 (Priority: P2) — Bound arrow follows dragged shape in real-time

**Goal**: When a shape with a bound arrow is dragged, the arrow moves in the draft layer on
every `pointerMove` — not only on `pointerUp`.

**Depends on**: Phase 4 complete (endpoint handles established; normalizeLinearBounds in place)

**Independent test**: Bind an arrow to a rect; drag the rect slowly; verify arrow follows
continuously while pointer is held. (See `quickstart.md` Scenario 4.)

- [ ] T012 [US4] In `frontend/src/canvas/tools/select-tool.ts`, update the single-element drag branch of `onSelectPointerMove` (the final `else` after `resizeSession`): after computing `setDraftElement`, find all non-deleted arrow elements with `startBinding` or `endBinding` targeting `draggingId`, recompute their `props.points` endpoints using `computeBindingPoint` (from `frontend/src/canvas/shapes/arrow-binding.ts` — confirmed to exist with `computeBindingPoint`, `parseBinding`, `findNearestSnap`) against the draft position `{ ...el, x: el.x+dx, y: el.y+dy }`, normalise their bbox with `normalizeLinearBounds` from `frontend/src/utils/geometry.ts`, and call `setDraftElements(arrowDrafts)`; `parseBinding` and `computeBindingPoint` are already imported at top of `select-tool.ts` (they are used in `onSelectPointerUp` for arrow snap) — add only if missing
- [ ] T013 [US4] In `frontend/src/canvas/tools/select-tool.ts`, update the multi-drag branch of `onSelectPointerMove` (`selectedIds.length > 1`): after building `drafts` for selected elements, append any non-selected arrows whose `startBinding`/`endBinding` targets a selected element, recomputing their points from the draft positions
- [ ] T014 [US4] In `frontend/src/canvas/tools/select-tool.ts`, update `onSelectPointerUp`: change the multi-drag early-return guard from `if (draftElements.length > 0)` to `if (draftElements.length > 0 && !draftElement)` (pure multi-drag); add a new block `if (draftElements.length > 0 && draftElement)` that commits `draftElements` (bound arrows) via `updateElements` and clears them, then falls through to the single-element commit; also add `setDraftElements([])` in the single-element path's cleanup at the end of `onSelectPointerUp`

---

## Phase 6: US5 (Priority: P3) — Regression: hit-test and undo/redo unaffected

**Goal**: All existing tests continue to pass after the refactor.

**Depends on**: Phases 3–5 complete

- [ ] T015 [US5] Run `pnpm typecheck` from repo root and fix any TypeScript errors caused by widening `HandleId` (callers that type-narrow on `resizeHandle` as `ResizeHandleId` may need to update their type annotations or narrow to `ResizeHandleId` explicitly) — files likely needing updates: `frontend/src/canvas/tools/select-tool.ts` (already edited), `frontend/src/canvas/layers/SvgLayer.tsx` (already edited); check for any remaining callers via `grep -r "resizeHandle" frontend/src`

---

## Polish & Cross-Cutting

- [ ] T016 Run `pnpm lint && pnpm format` from repo root and fix any lint or formatting issues across all changed files (`geometry.ts`, `arrow.tsx`, `line.tsx`, `mutation-pipeline.ts`, `interaction.ts`, `interaction.store.ts`, `SvgLayer.tsx`, `select-tool.ts`)

---

## Dependency Graph

```
T001 (normalizeLinearBounds)
  └── T002 [P] (unit tests for normalizeLinearBounds)
  └── T003 (arrow getBounds)          ─┐
  └── T004 [P] (line getBounds)        ├─ Phase 3 complete
  └── T005 (pipeline normalization)   ─┘
        └── T006 (HandleId types)
              └── T007 [P] (endpoint handles in overlay)  ─┐
              └── T008 (onSelectHandlePointerDown)          │
              └── T009 (onSelectPointerMove endpoint drag)  ├─ Phase 4 complete
              └── T010 (onSelectPointerUp snap binding)     │
              └── T011 [P] (endpoint handle tests)         ─┘
                    └── T012 (single-drag bound arrow)  ─┐
                    └── T013 (multi-drag bound arrow)    ├─ Phase 5 complete
                    └── T014 (pointerUp commit arrows)  ─┘
                          └── T015 (typecheck regression)
                                └── T016 (lint/format)
```

## Parallel Execution Opportunities

| Group | Tasks | Notes |
|-------|-------|-------|
| After T001 | T002 + T003 + T004 + T005 | T002/T004 in separate files; T003/T005 have distinct purposes |
| After T006 | T007 + T008 + T011 | T007 is SvgLayer; T008/T011 are select-tool logic and tests |
| After Phase 4 | T012 + T013 | Both are additions to `onSelectPointerMove` in same file — sequential within file but can be reviewed in parallel |

## Implementation Strategy

**MVP** (Phase 2 + Phase 3): Delivers AC-1/AC-2 — bbox always correct.
Estimated scope: T001–T005 (5 tasks across 3 files).

**Full feature**: Phases 2–6 in order (T001–T016, 16 tasks).

| Phase | Delivers | US |
|-------|----------|----|
| 2 | `normalizeLinearBounds` utility | Foundation |
| 3 | Correct `getBounds` + pipeline normalization | US1, US2 (P1) |
| 4 | Endpoint handle selection UX | US3 (P2) |
| 5 | Real-time arrow follow during drag | US4 (P2) |
| 6 | Regression verification | US5 (P3) |
| Polish | Lint/format | — |
