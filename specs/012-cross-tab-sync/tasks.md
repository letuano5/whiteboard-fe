# Tasks: Cross-Tab Sync (BroadcastChannel)

**Input**: Design documents from `specs/012-cross-tab-sync/`

**Prerequisites**: plan.md ✅ · spec.md ✅ · data-model.md ✅ · contracts/broadcast-message.md ✅

**Tests**: TDD — write tests FIRST (expect failure), then implement to make them green.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story this task belongs to (US1–US4)
- All file paths are relative to the repo root (`frontend/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Expose the hook-firing mechanism from the mutation pipeline so `apply-remote.ts` can fire hooks without bypassing the pipeline.

- [ ] T001 Export `dispatchMutationEvent(event: MutationEvent): void` from `src/store/mutation-pipeline.ts` (wraps the private `fireHooks`; no other changes to the file)

**Checkpoint**: `dispatchMutationEvent` is importable from `mutation-pipeline.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the two new sync modules with correct type structure and flag wiring. Stubs are enough — full logic lands in later phases.

⚠️ **CRITICAL**: No user story work begins until these two files exist.

- [ ] T002 Create `src/sync/apply-remote.ts` — export `isApplyingRemote(): boolean` (module-level flag), export `applyRemoteElements(incoming: Element[]): void` stub (body: `// TODO`), and import `useElementsStore`, `useInteractionStore`, `dispatchMutationEvent`
- [ ] T003 [P] Create `src/sync/broadcast-channel.ts` — export `initBroadcastChannel(): void` stub and `stopBroadcastChannel(): void` stub; import `registerMutationHook`, `isApplyingRemote`, `applyRemoteElements`

**Checkpoint**: Both files exist and compile (`pnpm typecheck` passes).

---

## Phase 3: User Story 1 + User Story 2 — Basic Sync & LWW (Priority: P1) 🎯 MVP

**Goal**: A new element created/moved/deleted/styled in Tab A appears in Tab B; concurrent edits converge via LWW.

**Independent Test**: Open two tabs, create a shape in Tab A, verify it appears in Tab B without refresh; also verify that a remote element with a lower version is ignored.

### Tests for US1 + US2 ⚠️ Write first — expect FAIL before T009

- [ ] T004 [P] [US1] Write test `@covers AC-1` in `src/sync/__tests__/apply-remote.test.ts`: given a new element not in store, `applyRemoteElements([el])` adds it to the elements store
- [ ] T005 [P] [US1] Write test `@covers AC-2` in `src/sync/__tests__/apply-remote.test.ts`: given an existing element at `(0,0)`, a remote element with higher version at `(100,100)` → store has element at `(100,100)`
- [ ] T006 [P] [US1] Write test `@covers AC-3` in `src/sync/__tests__/apply-remote.test.ts`: given an existing element with `isDeleted=false`, a remote element with higher version and `isDeleted=true` → store has `isDeleted=true`
- [ ] T007 [P] [US1] Write test `@covers AC-4` in `src/sync/__tests__/apply-remote.test.ts`: given an existing element, a remote element with higher version and different `props.fillColor` → store has updated `fillColor`
- [ ] T008 [P] [US2] Write test `@covers AC-5` in `src/sync/__tests__/apply-remote.test.ts`: incoming `version=6` vs local `version=5` → incoming wins (applied)
- [ ] T008b [P] [US2] Write test `@covers AC-6` in `src/sync/__tests__/apply-remote.test.ts`: incoming `version=4` vs local `version=5` → incoming loses (ignored)
- [ ] T008c [P] [US2] Write test `@covers AC-7` in `src/sync/__tests__/apply-remote.test.ts`: incoming `version=5, versionNonce=10` vs local `version=5, versionNonce=50` → incoming wins (lower nonce tiebreaks)
- [ ] T008d [P] [US2] Write test `@covers AC-8` in `src/sync/__tests__/apply-remote.test.ts`: incoming `version=5, versionNonce=80` vs local `version=5, versionNonce=50` → incoming loses (higher nonce loses)

### Implementation for US1 + US2

- [ ] T009 [US1] Implement `applyRemoteElements` body in `src/sync/apply-remote.ts`: build `storeMap`, split incoming into new vs existing, apply LWW comparison (AC-5/6/7/8), merge into store via `setElements`, call `dispatchMutationEvent` wrapped in `_isApplyingRemote = true/false`

**Checkpoint**: `pnpm test src/sync/__tests__/apply-remote.test.ts` — AC-1 through AC-8 tests pass.

---

## Phase 4: User Story 3 — Skip Active Elements (Priority: P2)

**Goal**: An element being dragged/resized/rotated/text-edited in Tab B is NOT overwritten by a concurrent remote update from Tab A during the interaction.

**Independent Test**: Set `draggingId` in interaction store to element `id`, call `applyRemoteElements` with a winning remote version of that element → element in store is unchanged.

### Tests for US3 ⚠️ Write first — expect FAIL before T014

- [ ] T010 [P] [US3] Write test `@covers AC-9` in `src/sync/__tests__/apply-remote.test.ts`: set `interactionStore.draggingId = el.id`, call `applyRemoteElements` with higher-version remote → local element unchanged
- [ ] T011 [P] [US3] Write test `@covers AC-10` in `src/sync/__tests__/apply-remote.test.ts`: set `interactionStore.resizeSession = { ... }` and `selectedIds = [el.id]`, call `applyRemoteElements` with higher-version remote → local element unchanged
- [ ] T012 [P] [US3] Write test `@covers AC-11` in `src/sync/__tests__/apply-remote.test.ts`: set `interactionStore.editingId = el.id`, call `applyRemoteElements` with higher-version remote → local element unchanged

### Implementation for US3

- [ ] T013 [US3] Add active-element skip logic to `applyRemoteElements` in `src/sync/apply-remote.ts`: read `draggingId`, `selectedIds`, `resizeSession`, `isRotating`, `editingId` from `useInteractionStore.getState()`; build `activeIds` set; skip elements in `activeIds`

**Checkpoint**: `pnpm test src/sync/__tests__/apply-remote.test.ts` — AC-9, AC-10, AC-11 tests now pass.

---

## Phase 5: User Story 4 — Remote Changes Persist Across Reload (Priority: P2)

**Goal**: Remote changes received in Tab B are saved to localStorage and survive a tab reload.

**Independent Test**: Call `applyRemoteElements`; verify `dispatchMutationEvent` was called with `type: 'update'`; verify the localStorage hook (already registered) would fire (localStorage hook is hooked to all mutation events including 'update').

### Tests for US4 ⚠️ Write first — expect FAIL before T016

- [ ] T014 [P] [US4] Write test `@covers AC-12` in `src/sync/__tests__/apply-remote.test.ts`: spy on `dispatchMutationEvent`; call `applyRemoteElements` with a new element; assert `dispatchMutationEvent` was called with `{ type: 'update', elements: [el], before: [...] }` (proves localStorage hook fires)

### Implementation for US4

- [ ] T015 [US4] Modify `src/sync/history-capture.ts`: add `import { isApplyingRemote } from './apply-remote'` and guard `if (isApplyingRemote()) return;` inside the mutation hook so remote-applied changes do NOT enter the undo stack

**Checkpoint**: `pnpm test src/sync/__tests__/apply-remote.test.ts` — AC-12 passes. History stack is not polluted by remote changes.

---

## Phase 6: BroadcastChannel Wiring

**Goal**: The whiteboard actually broadcasts mutations to other tabs and receives incoming broadcasts.

**Independent Test**: Open two browser tabs — shape created in Tab A appears in Tab B.

### Tests for Phase 6 ⚠️ Write first — expect FAIL before T018

- [ ] T016 [P] Write test `@covers AC-13` in `src/sync/__tests__/broadcast-channel.test.ts`: mock `BroadcastChannel`; call `initBroadcastChannel()`; fire a mutation hook event with `isApplyingRemote() === true`; assert `bc.postMessage` was NOT called (no re-broadcast of received remote messages)
- [ ] T017 [P] Write test `@covers AC-14` in `src/sync/__tests__/broadcast-channel.test.ts`: import `applyRemoteElements` from `apply-remote.ts`; assert the function signature accepts `(incoming: Element[])` with no BroadcastChannel-specific parameters — confirming it is reusable from a Socket.IO consumer without modification
- [ ] T017b [P] Write test for graceful degradation in `src/sync/__tests__/broadcast-channel.test.ts`: mock `globalThis.BroadcastChannel = undefined`; call `initBroadcastChannel()`; assert it returns without throwing and the elements store is unchanged
- [ ] T017c [P] Write test for `stopBroadcastChannel` in `src/sync/__tests__/broadcast-channel.test.ts`: call `initBroadcastChannel()` then `stopBroadcastChannel()`; assert `channel.close()` was called and a subsequent mutation hook event does NOT trigger `postMessage` (hook unregistered)

### Implementation for Phase 6

- [ ] T018 Implement `initBroadcastChannel` body in `src/sync/broadcast-channel.ts`: open `new BroadcastChannel('VDT_WHITEBOARD')`, set `channel.onmessage` to call `applyRemoteElements(event.data.elements)`, register mutation hook that calls `channel.postMessage({ elements: e.elements })` only when `!isApplyingRemote()`; guard for `typeof BroadcastChannel === 'undefined'` (graceful no-op fallback)
- [ ] T019 Implement `stopBroadcastChannel` in `src/sync/broadcast-channel.ts`: unregister mutation hook via the returned unregister fn, call `channel.close()`, reset module-level refs to `null`
- [ ] T020 Wire `initBroadcastChannel()` in `src/main.tsx`: add import and call after `startLocalStoragePersistence()`

**Checkpoint**: `pnpm test src/sync/__tests__/broadcast-channel.test.ts` — AC-13, AC-14, T017b (graceful), T017c (unmount) all pass. Manual two-tab test passes per `quickstart.md`.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Type-check, lint, final test run.

- [ ] T021 [P] Run `pnpm typecheck` — fix any TypeScript errors
- [ ] T022 [P] Run `pnpm lint` — fix any ESLint warnings in new/modified files
- [ ] T023 Run `pnpm test` — all existing tests still pass (no regressions)
- [ ] T024 Run `pnpm test src/sync/__tests__/` — all 14 AC-n tagged tests pass

**Checkpoint**: All tests green, typecheck clean, lint clean.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (needs `dispatchMutationEvent` export)
- **Phase 3 (US1+US2)**: Depends on Phase 2 (needs stub files to import from)
- **Phase 4 (US3)**: Depends on Phase 3 (active-skip builds on the same function)
- **Phase 5 (US4)**: Can start in parallel with Phase 4 (different concern: history guard)
- **Phase 6 (BC Wiring)**: Depends on Phase 2; can proceed after Phase 3 tests pass
- **Phase 7 (Polish)**: Depends on all previous phases

### User Story Dependencies

- **US1 + US2 (P1)**: Can start after Phase 2 — no other story dependency
- **US3 (P2)**: Can start after US1+US2 (builds on same function)
- **US4 (P2)**: Can start independently after Phase 2

### Within Each Phase

- Tests marked `[P]` MUST be written and FAIL before their implementation task
- All `[P]` tests within a phase can be written in parallel
- Implementation (T009, T013, T015, T018–T020) is sequential within each phase

---

## Parallel Example: Phase 3 Tests

```text
# All eight test stubs (T004–T008d) can be written in parallel:
T004: test @covers AC-1 (new element added)
T005: test @covers AC-2 (move/resize syncs)
T006: test @covers AC-3 (soft-delete syncs)
T007: test @covers AC-4 (style change syncs)
T008: test @covers AC-5 (higher version wins)
T008b: test @covers AC-6 (lower version ignored)
T008c: test @covers AC-7 (lower nonce tiebreaks)
T008d: test @covers AC-8 (higher nonce loses)

# Then implement T009 to make them all pass.
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: export `dispatchMutationEvent`
2. Complete Phase 2: create stubs
3. Write tests T004–T008d (Phase 3 tests)
4. Implement T009 (applyRemoteElements core)
5. **STOP and VALIDATE**: Run tests — AC-1 through AC-8 green
6. Wire Phase 6: basic two-tab sync is now functional

### Incremental Delivery

1. Phase 1 + 2 → stubs compile
2. Phase 3 → core LWW sync works (MVP!)
3. Phase 4 → safe during interactions
4. Phase 5 → changes survive reload
5. Phase 6 → real BroadcastChannel wiring
6. Phase 7 → clean + all tests green

---

## Notes

- `[P]` tasks = operate on different files or independent logic, no shared-state hazard
- `[US1]`/`[US2]`/`[US3]`/`[US4]` labels map to spec.md user stories
- Task IDs T008b, T008c, T008d continue from T008 (the 4 LWW sub-cases for US2)
- `isApplyingRemote()` is the single guard that prevents both re-broadcast (AC-13) and history pollution (AC-12) — implement it once in `apply-remote.ts`
- `applyRemoteElements` is the single implementation for both BroadcastChannel (this feature) and Socket.IO (Phase 2) — AC-14
- BroadcastChannel inherently does not echo to the sender (Web spec guarantee) — AC-13 test verifies the hook guard, not the browser behaviour
