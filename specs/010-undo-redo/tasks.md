# Tasks: Local Undo / Redo (P1B-06)

**Input**: Design documents from `specs/010-undo-redo/`

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **ACs**: [acceptance.md](acceptance.md)

**Branch**: `feat/local-editor`

**Tests**: TDD — test tasks per AC-n are included (one test per AC).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 = Undo Last Action, US2 = Redo, US3 = Multi-step/limits

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new packages or config needed — pipeline extensions are purely additive.

*(No setup tasks — all dependencies already in place per research.md)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pipeline and store infrastructure that all user stories depend on.

**⚠️ CRITICAL**: All Phase 3+ work requires these to be complete.

- [ ] T001 Extend `MutationEvent` interface with `before: Element[]` field, and update `createElement`, `patchElement`, `deleteElements`, `updateElements` to populate it in `src/store/mutation-pipeline.ts`
- [ ] T002 Add exported `applySnapshot(elements: Element[]): void` function to `src/store/mutation-pipeline.ts` — bumps version/versionNonce/updatedAt, writes via `useElementsStore.getState().updateElements()`, fires hooks with type `'update'`
- [ ] T003 Create `src/store/history.store.ts` with `HistoryEntry` interface, `useHistoryStore` Zustand store (undoStack, redoStack, isApplying, MAX_HISTORY_SIZE=100), and `push` / `undo` / `redo` actions
- [ ] T004 [P] Create `src/sync/history-capture.ts` exporting `initHistoryCapture(): () => void` — registers a mutation hook that calls `useHistoryStore.getState().push()` when `isApplying` is false (depends on T003)
- [ ] T005 [P] Register `initHistoryCapture()` call in `src/main.tsx` alongside `initLocalStoragePersistence` (depends on T004)
- [ ] T006 [P] Re-export `useHistoryStore` from `src/store/index.ts` (depends on T003)

**Checkpoint**: Foundation ready — keyboard handler and tests can now be implemented.

---

## Phase 3: User Story 1 — Undo Last Action (Priority: P1) 🎯 MVP

**Goal**: Pressing Ctrl/Cmd+Z reverses the most recent canvas mutation.

**Independent Test**: Draw a rectangle → press Ctrl+Z → rectangle disappears.

### Tests for User Story 1

> **Write tests FIRST; ensure they FAIL before implementing T008+.**

- [ ] T007 [P] [US1] Write test for AC-1 in `src/store/__tests__/history.store.test.ts`: after `createElement` call, call `undo()` → element's `isDeleted` becomes `true` in the store (`@covers AC-1`)
- [ ] T008 [P] [US1] Write test for AC-2 in `src/store/__tests__/history.store.test.ts`: after `patchElement` (move), call `undo()` → element position reverts to before-state (`@covers AC-2`)
- [ ] T009 [P] [US1] Write test for AC-3 in `src/store/__tests__/history.store.test.ts`: after `patchElement` (resize/rotate), call `undo()` → dimensions/angle revert (`@covers AC-3`)
- [ ] T010 [P] [US1] Write test for AC-4 in `src/store/__tests__/history.store.test.ts`: after `deleteElements`, call `undo()` → element's `isDeleted` becomes `false` (`@covers AC-4`)
- [ ] T011 [P] [US1] Write test for AC-5 in `src/store/__tests__/history.store.test.ts`: after `patchElement` (style/text), call `undo()` → previous style/text restored (`@covers AC-5`)
- [ ] T012 [P] [US1] Write test for AC-6 in `src/store/__tests__/history.store.test.ts`: call `undo()` on empty stack → store state unchanged, no error thrown (`@covers AC-6`)

### Implementation for User Story 1

- [ ] T013 [US1] Add `keydown` event handler for `Ctrl/Cmd+Z` (no Shift) in `src/canvas/Whiteboard.tsx` `useEffect` — calls `useHistoryStore.getState().undo()` (depends on T003)

**Checkpoint**: User Story 1 independently functional — Ctrl+Z undoes the last action.

---

## Phase 4: User Story 2 — Redo Undone Action (Priority: P2)

**Goal**: Pressing Ctrl/Cmd+Shift+Z re-applies the last undone action.

**Independent Test**: Draw shape → Ctrl+Z (gone) → Ctrl+Shift+Z → shape reappears.

### Tests for User Story 2

- [ ] T014 [P] [US2] Write test for AC-7 in `src/store/__tests__/history.store.test.ts`: after `createElement` + `undo()`, call `redo()` → element's `isDeleted` becomes `false` again (`@covers AC-7`)
- [ ] T015 [P] [US2] Write test for AC-8 in `src/store/__tests__/history.store.test.ts`: call `redo()` on empty redoStack → no change, no error (`@covers AC-8`)
- [ ] T016 [P] [US2] Write test for AC-9 in `src/store/__tests__/history.store.test.ts`: undo one action, perform a new `createElement`, then call `redo()` → no-op (redoStack cleared by new action) (`@covers AC-9`)

### Implementation for User Story 2

- [ ] T017 [US2] Extend the `keydown` handler in `src/canvas/Whiteboard.tsx` to also handle `Ctrl/Cmd+Shift+Z` — calls `useHistoryStore.getState().redo()` (same `useEffect` as T013)

**Checkpoint**: User Stories 1 AND 2 independently functional.

---

## Phase 5: User Story 3 — Multi-Step Undo / Redo (Priority: P2)

**Goal**: Support navigating back and forth through ≥ 100 history steps.

**Independent Test**: Perform 5 distinct actions → press Ctrl/Cmd+Z five times → all 5 reversed in reverse order.

### Tests for User Story 3

- [ ] T018 [P] [US3] Write test for AC-10 in `src/store/__tests__/history.store.test.ts`: push 5 distinct entries, call `undo()` 5 times → states reversed in LIFO order (`@covers AC-10`)
- [ ] T019 [P] [US3] Write test for AC-11 in `src/store/__tests__/history.store.test.ts`: undo 3 times, then `redo()` 2 times → 2 redone in chronological order, 1 still undone (`@covers AC-11`)
- [ ] T020 [P] [US3] Write test for AC-12 in `src/store/__tests__/history.store.test.ts`: push 101 entries → undoStack.length remains ≤ 100; oldest entry was discarded (`@covers AC-12`)

*(AC-10/11/12 behavior is implemented inside `history.store.ts` T003 — verify via the tests above.)*

**Checkpoint**: Full multi-step undo/redo working; history limit enforced.

---

## Phase 6: Pipeline Integration & Keyboard Guard Tests

**Purpose**: Verify AC-13 (all four pipeline functions captured), AC-14 (version++), and AC-15 (keyboard guard).

- [ ] T021 [P] Write test for AC-13 in `src/store/__tests__/history.store.test.ts`: call each pipeline function (`createElement`, `patchElement`, `deleteElements`, `updateElements`) once → undoStack has exactly 4 entries (`@covers AC-13`)
- [ ] T022 [P] Write test for AC-14 in `src/store/__tests__/history.store.test.ts`: after `undo()` and `redo()`, check that affected element's `version` is incremented relative to before the undo/redo call (`@covers AC-14`)
- [ ] T023 [P] Write test for AC-15 in `src/store/__tests__/history.store.test.ts`: simulate a `keydown` event with `Ctrl+Z` while `target` is an `INPUT` element → `undo()` is NOT called (stack unchanged) (`@covers AC-15`)

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T024 Run `pnpm typecheck` and resolve any TypeScript errors
- [ ] T025 Run `pnpm lint` and fix any lint violations
- [ ] T026 Run full test suite with `pnpm test` and confirm all AC tests pass
- [ ] T027 Run `bash scripts/check-ac-coverage.sh` and confirm all AC-1 through AC-15 have `@covers` tags
- [ ] T028 Manual validation per `specs/010-undo-redo/quickstart.md` scenarios 1–8

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: Must complete before ANY user story — T001→T002→T003 must be sequential (T004/T005/T006 can run after T003)
- **US1 tests (T007–T012)**: Can start once T003 exists (tests will fail until T013)
- **US1 impl (T013)**: Requires T003 (store)
- **US2 tests (T014–T016)**: Can start after US1 tests; `redo()` is in the same store
- **US2 impl (T017)**: Extends T013's `useEffect` — sequential
- **US3 tests (T018–T020)**: Can start independently (behavior in T003)
- **Pipeline/Guard tests (T021–T023)**: Parallel after T003 and keyboard handler
- **Polish (T024–T028)**: After all tests pass

### Within Phase 2 (sequential order)

```
T001 → T002 → T003 → T004 (parallel)
                    → T005 (parallel)
                    → T006 (parallel)
```

### Parallel Opportunities

- All test tasks within a phase (marked [P]) can be written simultaneously into the same test file
- T004, T005, T006 can proceed in parallel after T003
- T024 and T025 (typecheck + lint) can run together

---

## Parallel Example: Phase 2 Foundational

```bash
# Sequential within Phase 2:
Task T001: Extend MutationEvent + pipeline functions in src/store/mutation-pipeline.ts
Task T002: Add applySnapshot to src/store/mutation-pipeline.ts
Task T003: Create src/store/history.store.ts

# Then in parallel:
Task T004: Create src/sync/history-capture.ts
Task T005: Register in src/main.tsx
Task T006: Re-export from src/store/index.ts
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Complete Phase 2: Foundational (T001–T006)
2. Write US1 tests (T007–T012) — verify they FAIL
3. Implement T013 (keyboard Ctrl+Z handler)
4. **STOP and VALIDATE**: `pnpm test` — AC-1 through AC-6 must pass

### Incremental Delivery

1. Foundational (Phase 2) → undo working
2. Add redo (Phase 4) → US1 + US2 both testable
3. Verify multi-step (Phase 5) → complete feature
4. Pipeline/guard tests (Phase 6) → full AC coverage
5. Polish (Phase 7) → typecheck + lint + quickstart

---

## Notes

- `history.store.ts` implements all three user stories' store logic — T003 is the highest-risk task
- `applySnapshot` (T002) must handle soft-deleted elements correctly (restore `isDeleted: false` on undo-of-delete)
- `isApplying` flag prevents history capture during undo/redo application
- Tests use `vitest` + `@testing-library/react` per existing test in `src/store/__tests__/mutation-pipeline.test.ts`
- AC-15 keyboard guard test mocks a DOM `INPUT` element as `event.target`
