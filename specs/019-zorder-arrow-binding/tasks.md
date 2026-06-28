# Tasks: Z-order UI & Arrow Binding (P2.5-02 & P2.5-03)

**Input**: Design documents from `specs/019-zorder-arrow-binding/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Test policy**: One unit test task per AC (AC-1 → AC-18), oracle text from `acceptance.md` only.

**Organization**: Tasks are grouped by user story. US1 (z-order) and US2 (arrow binding) are both P1
and can be worked in parallel once foundational utilities are ready.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no sequential dependency)
- **[US1/US2/US3]**: User story label
- Exact file paths are included in every task description

---

## Phase 1: Foundational Utilities

**Purpose**: Shared helper modules used by both US1 (z-order) and US2 (arrow binding). Must be
complete before either user story begins.

**⚠️ CRITICAL**: US1 and US2 implementation tasks depend on this phase.

- [x] T001 [P] Create `frontend/src/store/zorder.ts` — export `bringToFront(id)`, `sendToBack(id)`, `bringForward(id)`, `sendBackward(id)`; each reads elements store and calls `updateElements` with the minimal changed set; handle boundary no-ops silently
- [x] T002 [P] Create `frontend/src/canvas/shapes/arrow-binding.ts` — export `ARROW_SNAP_THRESHOLD = 20`, `getAttachmentPoints(el: Element): {key: string; x: number; y: number}[]`, `findNearestSnap(pt: {x;y}, elements: Element[], excludeId: string): {elementId: string; pointKey: string; x: number; y: number} | null`, `parseBinding(b: string | null | undefined): {elementId: string; pointKey: string} | null`, `computeBindingPoint(target: Element, pointKey: string): {x: number; y: number}`

**Checkpoint**: Both utility modules compile with `pnpm typecheck --filter whiteboard-fe`

---

## Phase 2: User Story 1 — Change Layer Order (Priority: P1) 🎯 MVP

**Goal**: Users can right-click a shape and reorder its z-index via context menu; change syncs to all
clients.

**Independent Test**: Draw two overlapping rectangles → right-click the bottom one → "Bring to
Front" → the bottom rect is now rendered on top.

### Tests for User Story 1 (write before implementation; verify they FAIL first)

- [x] T003 [P] [US1] Write test for AC-1 in `frontend/src/store/__tests__/zorder.test.ts`: given elements A(zIndex=0) below B(zIndex=1), `bringToFront(A.id)` sets A's zIndex > B's zIndex; assert `updateElements` is called with only A; assert version increments
- [x] T004 [P] [US1] Write test for AC-2 in `frontend/src/store/__tests__/zorder.test.ts`: given C at top, `sendToBack(C.id)` sets C's zIndex < all others; assert only C is updated
- [x] T005 [P] [US1] Write test for AC-3 in `frontend/src/store/__tests__/zorder.test.ts`: given A(0) < B(1) < C(2), `bringForward(A.id)` swaps A and B zIndex values; assert exactly two elements updated
- [x] T006 [P] [US1] Write test for AC-4 in `frontend/src/store/__tests__/zorder.test.ts`: given A(0) < B(1) < C(2), `sendBackward(C.id)` swaps C and B zIndex values; assert exactly two elements updated
- [x] T007 [P] [US1] Write test for AC-5 in `frontend/src/store/__tests__/zorder.test.ts`: `bringToFront` and `bringForward` on the topmost element → `updateElements` is NOT called (no-op)
- [x] T008 [P] [US1] Write test for AC-6 in `frontend/src/store/__tests__/zorder.test.ts`: `sendToBack` and `sendBackward` on the bottommost element → `updateElements` is NOT called (no-op)
- [x] T009 [P] [US1] Write test for AC-7 in `frontend/src/components/context-menu/__tests__/ContextMenu.test.tsx`: render `<ContextMenu selectedCount={2} ... />` → z-order buttons have `disabled` attribute or are absent from DOM

### Implementation for User Story 1

- [x] T010 [US1] Create `frontend/src/components/context-menu/ContextMenu.tsx` — floating DOM `<div>` positioned at `{x, y}` screen coords; props: `x`, `y`, `selectedId: string | null`, `selectedCount: number`, `onClose()`; renders "Bring to Front", "Forward", "Backward", "Send to Back" buttons; all four disabled (visually greyed, `disabled` attr) when `selectedCount !== 1`; calls corresponding `zorder.ts` function and `onClose()` on click
- [x] T011 [US1] Add context menu state to `frontend/src/canvas/Whiteboard.tsx` — add `useState<{x:number;y:number;id:string}|null>(null)` for `contextMenu`; add `onContextMenu` handler on the SVG that calls `e.preventDefault()`, converts screen position, finds the hit element (reuse select-tool hit detection), and sets `contextMenu` state; add click-outside/Escape dismissal via `useEffect`
- [x] T012 [US1] Render `<ContextMenu>` inside `Whiteboard.tsx` — conditionally render the context menu component when `contextMenu !== null`; pass `selectedIds.length` as `selectedCount`; the menu must appear above all canvas elements (CSS `z-index` > toolbar)

**Checkpoint**: Right-click a shape → context menu appears; click "Bring to Front" → shape reorders; second tab shows the change; all US1 tests pass.

---

## Phase 3: User Story 2 — Arrow Binding Snap (Priority: P1)

**Goal**: Arrow endpoints snap to shapes when drawn or repositioned; arrows follow their bound shapes
on move and resize.

**Independent Test**: Draw a rectangle → draw an arrow, drop its end endpoint within 20px of the
rectangle → move the rectangle → the arrow endpoint follows.

### Tests for User Story 2 (write before implementation; verify they FAIL first)

- [x] T013 [P] [US2] Write test for AC-8 in `frontend/src/canvas/shapes/__tests__/arrow-binding.test.ts`: (a) `findNearestSnap({x, y}, [shapeEl], arrowId)` where `{x, y}` is within 20px of shapeEl's centre → returns `{elementId: shapeEl.id, pointKey: 'center', x: ..., y: ...}`; assert endpoint is the exact attachment point world position; (b) tie-breaking: two shapes equidistant from endpoint → shape with higher `zIndex` wins; assert returned `elementId` is the higher-zIndex shape
- [x] T014 [P] [US2] Write test for AC-9 in `frontend/src/canvas/shapes/__tests__/arrow-binding.test.ts`: given arrow with `endBinding = "shapeId:center"` and shapeEl moved to new position → mutation hook cascades `updateElements` on arrow → arrow's `props.points[1]` equals new centre of shapeEl
- [x] T015 [P] [US2] Write test for AC-10 in `frontend/src/canvas/shapes/__tests__/arrow-binding.test.ts`: given arrow bound to shapeEl, shapeEl resized → mutation hook updates arrow's `props.points[1]` to reflect new geometry (e.g., if bound at 'top', y equals shapeEl.y with updated x)
- [x] T016 [P] [US2] Write test for AC-11 in `frontend/src/canvas/shapes/__tests__/arrow-binding.test.ts`: given arrow with `endBinding = "shapeId:center"`, shapeEl deleted (isDeleted=true) → mutation hook sets arrow's `endBinding = null`; arrow's `props.points[1]` stays at shapeEl's last position; arrow `isDeleted` remains false
- [x] T017 [P] [US2] Write test for AC-12 in `frontend/src/canvas/shapes/__tests__/arrow-binding.test.ts`: given arrow with existing `endBinding = "shapeId:center"`, endpoint dragged > 20px from all shapes and released → `findNearestSnap` returns `null` → assert `patchElement` called with `endBinding: null` and `props.points[1]` set to the release position (binding explicitly removed)
- [x] T018 [P] [US2] Write test for AC-13 in `frontend/src/canvas/shapes/__tests__/arrow-binding.test.ts`: given a freshly drawn arrow (no prior binding), endpoint released > 20px from all shapes → `findNearestSnap` returns `null` → assert `createElement` called with `endBinding: null` (never set); endpoint free-placed at release position

### Implementation for User Story 2

- [x] T019 [US2] Create `frontend/src/sync/arrow-binding-hook.ts` — implement and export `createArrowBindingHook()` that returns a `MutationHook`; the hook:
  (a) on any `patch`/`update`/`delete` event for a non-arrow element, reads all elements from `useElementsStore.getState()`, finds arrows whose `props.startBinding` or `props.endBinding` references any mutated element id;
  (b) for each bound arrow, recomputes the affected endpoint position using `computeBindingPoint` from `arrow-binding.ts`; if the target is deleted, sets the binding to `null` and keeps the last position;
  (c) calls `updateElements` with a batch patch of all affected arrows; skips if no arrows need updating to avoid infinite recursion
- [x] T020 [US2] Register the arrow-binding hook in `frontend/src/app/App.tsx` — call `registerMutationHook(createArrowBindingHook())` inside a `useEffect(() => ..., [])` (run once on mount); return the unregister function from the effect cleanup; import from `frontend/src/sync/arrow-binding-hook.ts` and `frontend/src/store/mutation-pipeline.ts`
- [x] T021 [US2] Modify `frontend/src/canvas/tools/create-shape-tool.ts` — in `onShapePointerUp`, after the shape size validity check and before calling `createElement`, if the tool is `'arrow'`:
  (a) call `findNearestSnap(start, elements, '__draft__')` for the start endpoint → if found, set `startBinding`, snap `points[0]` to attachment point;
  (b) call `findNearestSnap(end, elements, '__draft__')` for the end endpoint → if found, set `endBinding`, snap `points[1]` to attachment point;
  (c) pass the resolved `startBinding`/`endBinding` in the `props` passed to `createElement`
- [x] T022 [US2] Modify `frontend/src/canvas/tools/select-tool.ts` — in `onSelectPointerUp`, after committing a resize for an arrow element:
  (a) detect which endpoint moved by comparing committed `props.points[0]` and `props.points[1]` to the pointerUp world position;
  (b) call `findNearestSnap` for that endpoint; if snap found: set the corresponding `startBinding`/`endBinding` on the patch; if no snap: set the binding to `null` (release);
  (c) also update `props.points[i]` to the snapped attachment point position (or release position)
- [x] T023 [US2] Add snap indicator to `frontend/src/canvas/layers/SvgLayer.tsx` — when the active tool is `'arrow'` and `draftElement` exists: for each element close to either draft endpoint (within threshold), render a small `<circle>` ring at the nearest attachment point using `getAttachmentPoints` from `arrow-binding.ts` (only show the closest attachment point that would snap; stroke `#3b82f6`, `fill="none"`, radius 6, opacity 0.7); store no state — compute purely from draftElement and elements list in render

**Checkpoint**: Draw arrow that snaps to a shape; move shape; arrow follows. Move arrow endpoint
away; binding clears. All US2 tests pass.

---

## Phase 4: User Story 3 — Real-time Sync (Priority: P2)

**Goal**: Z-order changes and arrow binding state (including cascade moves) propagate to all clients
in a room within 500 ms.

**Independent Test**: Two tabs in same room. Tab A: change z-order / bind arrow / move bound shape.
Tab B: sees all changes without refresh.

### Tests for User Story 3

- [x] T024 [P] [US3] Write test for AC-14 in `frontend/src/sync/__tests__/apply-remote.test.ts`: simulate `applyRemoteElements` with an element having a new `zIndex` → assert element in store has updated `zIndex`; assert mutation hook fires (spy on `fireHooks` or use registered hook)
- [x] T025 [P] [US3] Write test for AC-15 in `frontend/src/sync/__tests__/apply-remote.test.ts`: simulate `applyRemoteElements` with an arrow element having updated `endBinding` → assert arrow in store reflects the new binding string
- [x] T026 [P] [US3] Write test for AC-16 in `frontend/src/sync/__tests__/apply-remote.test.ts`: simulate `applyRemoteElements` with a shape move; arrow-binding-hook must be registered; assert the arrow's `props.points[1]` is updated to reflect the new shape position

### Implementation for User Story 3

- [x] T027 [US3] Verify `applyRemoteElements` in `frontend/src/sync/apply-remote.ts` fires mutation hooks — the current implementation already calls `dispatchMutationEvent` (via `fireHooks`) after updating the store, so arrow-binding-hook will fire for remote element updates too; this task is test-only: add assertions in `frontend/src/sync/__tests__/apply-remote.test.ts` confirming the hook fires when a remote shape move is applied and that bound arrow endpoints update accordingly

**Checkpoint**: AC-14/AC-15/AC-16 tests pass; confirmed via two-tab manual test described in
`specs/019-zorder-arrow-binding/quickstart.md` Scenarios 12–13.

---

## Phase 5: Undo/Redo (Cross-cutting)

**Purpose**: Verify existing undo/redo pipeline covers z-order and binding mutations automatically
(no new undo code needed — pipeline already captures history on every `patchElement`/`updateElements` call).

### Tests

- [x] T028 [P] Write test for AC-17 in `frontend/src/store/__tests__/zorder.test.ts`: call `bringToFront(id)` → call `undo()` from `useHistoryStore` → assert element's `zIndex` is restored to its original value
- [x] T029 [P] Write test for AC-18 in `frontend/src/canvas/shapes/__tests__/arrow-binding.test.ts`: simulate arrow binding creation via `patchElement` with `endBinding = "shapeId:center"` → call `undo()` → assert `endBinding = null` and `props.points[1]` is back to the pre-snap position

### Implementation

- [x] T030 Confirm in `frontend/src/store/history.store.ts` that `updateElements` calls are captured in undo history (read the store — no code change expected); if not captured, register a mutation hook in `history.store.ts` that records `update` events alongside `patch` events

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T031 [P] Run `pnpm typecheck` from repo root — fix all TypeScript errors in changed files (`zorder.ts`, `arrow-binding.ts`, `arrow-binding-hook.ts`, `ContextMenu.tsx`, `Whiteboard.tsx`, `create-shape-tool.ts`, `select-tool.ts`, `SvgLayer.tsx`, `App.tsx`)
- [x] T032 [P] Run `pnpm lint --filter whiteboard-fe` — fix all ESLint errors in changed files
- [x] T033 Run `pnpm test --filter whiteboard-fe` — all 29 new test tasks (T003–T029) plus existing tests must pass; fix any regressions
- [x] T034 Run quickstart.md validation Scenarios 1–14 manually in the browser (`pnpm dev:all`) — confirm all acceptance criteria pass in the live app

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies — start immediately; T001 and T002 in parallel
- **Phase 2 (US1)**: Depends on T001 (zorder.ts) only; US1 tests T003–T008 can be written in parallel with T001
- **Phase 3 (US2)**: Depends on T002 (arrow-binding.ts) only; US2 tests T013–T018 can be written in parallel with T002
- **Phase 4 (US3)**: Depends on T019–T022 (hook + tool integration) from Phase 3
- **Phase 5 (Undo)**: Depends on T001 and T002; no ordering dependency on Phases 2–4
- **Phase 6 (Polish)**: Depends on all previous phases

### Within Each Story

```
US1:  T001 → T003..T009 (tests, parallel) → T010 → T011 → T012
US2:  T002 → T013..T018 (tests, parallel) → T019 → T020 → T021 → T022 → T023
US3:  T019+T020 done → T024..T026 (tests, parallel) → T027
```

### Parallel Opportunities

```bash
# Phase 1 — run together:
T001  # frontend/src/store/zorder.ts
T002  # frontend/src/canvas/shapes/arrow-binding.ts

# Phase 2 US1 tests — run together (all target same new file):
T003 T004 T005 T006 T007 T008  # zorder.test.ts
T009                             # ContextMenu.test.tsx

# Phase 3 US2 tests — run together:
T013 T014 T015 T016 T017 T018  # arrow-binding.test.ts

# Phase 4 US3 tests — run together:
T024 T025 T026  # apply-remote.test.ts

# Phase 5 undo tests — run together:
T028  # zorder.test.ts
T029  # arrow-binding.test.ts

# Phase 6 polish — run together:
T031  # typecheck
T032  # lint
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: T001 (zorder.ts only — T002 can be deferred)
2. Write US1 tests T003–T009 (verify FAIL)
3. Complete US1 implementation T010 → T011 → T012
4. **STOP and VALIDATE**: Run `pnpm test`, open browser, right-click shapes → z-order works

### Incremental Delivery

1. Phase 1 + Phase 2 (US1) → Z-order UI shipped
2. Phase 3 (US2) → Arrow binding shipped
3. Phase 4 (US3) → Sync verified
4. Phase 5 (Undo) → Undo confirmed
5. Phase 6 → Polish and final validation

---

## Notes

- All 18 ACs covered: AC-1..7 (US1 tests T003–T009), AC-8..13 (US2 tests T013–T018), AC-14..16 (US3 tests T024–T026), AC-17..18 (undo tests T028–T029)
- `[P]` tasks operate on different files — no conflicts
- No backend changes required — `element-update` already relays `zIndex` and `props.startBinding`/`endBinding`
- Commit after T001+T002, after US1 checkpoint, after US2 checkpoint, and after Phase 6
