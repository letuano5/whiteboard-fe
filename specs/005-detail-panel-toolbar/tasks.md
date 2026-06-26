# Tasks: Detail Panel & Basic Toolbar (P1A-07 + P1A-08)

**Input**: Design documents from `specs/005-detail-panel-toolbar/`

**Context**: Both features are **already implemented** and 196 tests pass. Tasks focus on:
1. Verifying existing code satisfies the spec (read-only inspection)
2. Adding `@covers AC-n (005-detail-panel-toolbar)` tags to existing tests so the registry is covered
3. Writing new tests for gaps in AC-8 and AC-9

**Organization**: Grouped by user story (spec.md). Each story's work: tag existing tests → add missing tests → verify.

---

## Phase 1: Setup (No new infrastructure needed)

Implementation already in place. No setup tasks.

---

## Phase 2: Foundational — Verify Integration

**Purpose**: Confirm both components are wired into the Whiteboard and the store is accessible.

- [ ] T001 Verify `Whiteboard.tsx` renders `<Toolbar />` and `<DetailPanel />` in `src/canvas/Whiteboard.tsx`
- [ ] T002 Verify `DetailPanel` imports `useElementsStore`, `useInteractionStore`, and `patchElement` from correct paths in `src/components/detail-panel/DetailPanel.tsx`
- [ ] T003 Verify `Toolbar` imports `useInteractionStore` and `ToolId` from correct paths in `src/components/toolbar/Toolbar.tsx`

**Checkpoint**: Both components confirmed wired — user story work can proceed.

---

## Phase 3: User Story 1 — Panel Visibility (Priority: P1) 🎯 MVP

**Goal**: Detail panel shows when exactly one shape is selected, hides when no selection or multi-selection.

**Covers**: AC-1, AC-2, AC-3

**Independent Test**: Click a shape → panel appears. Click canvas → panel disappears. Select 2 shapes → panel disappears.

### Tests for User Story 1

- [ ] T004 [US1] Add `// @covers AC-1 (005-detail-panel-toolbar)` to "renders nothing when selectedIds is empty" test in `src/components/detail-panel/__tests__/DetailPanel.test.tsx`
- [ ] T005 [US1] Add `// @covers AC-2 (005-detail-panel-toolbar)` to "shows stroke color control when a shape is selected" test in `src/components/detail-panel/__tests__/DetailPanel.test.tsx`
- [ ] T006 [US1] Add `// @covers AC-3 (005-detail-panel-toolbar)` to "renders nothing when selectedIds has multiple items" test in `src/components/detail-panel/__tests__/DetailPanel.test.tsx`

**Checkpoint**: AC-1, AC-2, AC-3 tagged — panel visibility coverage confirmed.

---

## Phase 4: User Story 2 — Realtime Property Editing (Priority: P1)

**Goal**: Editing any property in the panel immediately updates the element via patchElement, and displayed values match the store.

**Covers**: AC-4, AC-5, AC-6

**Independent Test**: Select a shape, change stroke color — shape updates immediately. Store shows the new value.

### Tests for User Story 2

- [ ] T007 [US2] Add `// @covers AC-4 (005-detail-panel-toolbar)` to "calls patchElement with new strokeColor" test in `src/components/detail-panel/__tests__/DetailPanel.test.tsx`
- [ ] T008 [US2] Add `// @covers AC-5 (005-detail-panel-toolbar)` to "patchElement is called exactly once per change" test in `src/components/detail-panel/__tests__/DetailPanel.test.tsx`
- [ ] T009 [US2] Add `// @covers AC-6 (005-detail-panel-toolbar)` to "displays current strokeColor value from store" test in `src/components/detail-panel/__tests__/DetailPanel.test.tsx`

**Checkpoint**: AC-4, AC-5, AC-6 tagged — realtime update coverage confirmed.

---

## Phase 5: User Story 3 — Panel Does Not Disrupt Selection (Priority: P2)

**Goal**: Clicking inside the panel does not deselect the shape or trigger canvas events.

**Covers**: AC-7

**Independent Test**: Select a shape, click the stroke-width input — shape stays selected.

### Tests for User Story 3

- [ ] T010 [US3] Write new test `// @covers AC-7 (005-detail-panel-toolbar)` — render DetailPanel with a selected shape, fire `pointerdown` on the panel root div, assert `useInteractionStore.getState().selectedIds` is unchanged (still contains the selected id) in `src/components/detail-panel/__tests__/DetailPanel.test.tsx`

**Checkpoint**: AC-7 tagged/added — pointer containment coverage confirmed.

---

## Phase 6: User Story 4 — Toolbar Tool Selection (Priority: P1)

**Goal**: Toolbar shows 6 specific tools, highlights the active one, and clears interaction state on switch.

**Covers**: AC-8, AC-9, AC-10, AC-11, AC-12

**Independent Test**: Load toolbar — 6 buttons visible. Click Rectangle — it turns blue, select tool turns neutral, selection cleared.

### Tests for User Story 4

- [ ] T011 [P] [US4] Write new test `// @covers AC-8 (005-detail-panel-toolbar)` — render Toolbar, assert exactly 6 buttons with titles "Select", "Hand", "Rectangle", "Ellipse", "Line", "Text" in `src/components/toolbar/__tests__/Toolbar.test.tsx`
- [ ] T012 [P] [US4] Write new test `// @covers AC-9 (005-detail-panel-toolbar)` — render Toolbar with active tool = 'rectangle', assert Rectangle button has different background style than other buttons in `src/components/toolbar/__tests__/Toolbar.test.tsx`
- [ ] T013 [US4] Add `// @covers AC-10 (005-detail-panel-toolbar)` to existing "clears selected element and transient interaction state when choosing a tool" test (verify `tool === 'rectangle'` assertion) in `src/components/toolbar/__tests__/Toolbar.test.tsx`
- [ ] T014 [US4] Add `// @covers AC-11 (005-detail-panel-toolbar)` to existing test (verify `selectedIds === []` assertion) in `src/components/toolbar/__tests__/Toolbar.test.tsx`
- [ ] T015 [US4] Add `// @covers AC-12 (005-detail-panel-toolbar)` to existing test (verify draggingId, dragStart, draftElement, resizeHandle, resizeSession all null) in `src/components/toolbar/__tests__/Toolbar.test.tsx`

**Checkpoint**: All toolbar ACs covered — AC-8 through AC-12 tagged/added.

---

## Phase 7: Polish & Verification

- [ ] T016 [P] Run `pnpm test --run` and confirm all tests pass (≥196 tests, 0 failures)
- [ ] T017 [P] Run `pnpm typecheck` and confirm no TypeScript errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately
- **US1 (Phase 3)**, **US2 (Phase 4)**, **US3 (Phase 5)**, **US4 (Phase 6)**: All independent — can proceed after Phase 2 verification
- **Polish (Phase 7)**: Depends on all story phases complete

### User Story Dependencies

- **US1** (Panel Visibility — AC-1,2,3): Independent
- **US2** (Realtime Editing — AC-4,5,6): Independent from US1
- **US3** (No Disrupt Selection — AC-7): Independent
- **US4** (Toolbar — AC-8,9,10,11,12): Independent

### Parallel Opportunities

- T004–T006 (US1 tags) can run in parallel
- T007–T009 (US2 tags) can run in parallel
- T011 and T012 (new toolbar tests) can run in parallel

---

## Parallel Example: Toolbar AC Coverage (Phase 6)

```bash
# Run these in parallel (different test additions, same file but independent assertions):
Task T011: Write AC-8 test (6 tools count)
Task T012: Write AC-9 test (active tool highlight)
```

---

## Implementation Strategy

### MVP First

1. Phase 2: Verify integration (T001–T003) — read-only, ≤5 min
2. Phase 3–5: Tag existing DetailPanel tests (T004–T010) — file edits only
3. Phase 6: Tag + add Toolbar tests (T011–T015) — new test cases for AC-8, AC-9
4. Phase 7: Run test suite — confirm green

### Incremental Delivery

All tasks are additive (tag comments or new test `it()` blocks). No production code changes expected. Each phase checkpoint = run `pnpm test --run` and confirm green before moving on.
