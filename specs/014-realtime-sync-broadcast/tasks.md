# Tasks: Realtime Sync & Broadcast

**Input**: Design documents from `specs/014-realtime-sync-broadcast/`

**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Tests**: Included (TDD — one test task per AC-n; expected values from acceptance.md only).

**Organization**: Implementation is already complete. All tasks in this file are test-coverage
tasks — annotating existing tests and writing new tests for the three ACs that lack explicit
coverage. No new source-code (non-test) files are needed.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

*(No setup tasks — implementation is already complete and all infrastructure is in place.)*

---

## Phase 2: Foundational — Tag Existing Tests

**Purpose**: Add `@covers 014/AC-n` annotations to existing tests so the AC coverage guard can
verify P2-02~P2-05 acceptance criteria against the 014 registry.

**⚠️ NOTE**: These existing tests already pass (378/378 green). Adding `@covers` comments does
NOT change test logic — only adds traceability.

### AC-1, AC-2, AC-3, AC-4 — Broadcast (socket-client.test.ts + apply-remote.test.ts)

- [ ] T001 [P] [US1] Add `@covers 014/AC-1` comment to the `applyRemoteElements` call assertion in `frontend/src/sync/__tests__/socket-client.test.ts` (describe "AC-5" block) — this test proves element-update events call `applyRemoteElements`, which is the delivery mechanism for AC-1.
- [ ] T002 [P] [US1] Add `@covers 014/AC-2` and `@covers 014/AC-3` comments to the "AC-2: element position/size update syncs" and "AC-3: soft-delete propagates" describe blocks in `frontend/src/sync/__tests__/apply-remote.test.ts`.
- [ ] T003 [US1] Write new test `@covers 014/AC-4` in `frontend/src/sync/__tests__/socket-client.test.ts`: call `initSocketClient('room-xyz')`, then call `dispatchMutationEvent({ type: 'update', elements: [fakeElement], before: [] })` (import from `../../store/mutation-pipeline`), then assert `mockEmit` was called with `(WS_EVENTS.ELEMENT_UPDATE, { roomId: 'room-xyz', elements: [fakeElement] })`. This proves the client sends `roomId` with every mutation, enabling the server's `socket.to(roomId)` to exclude clients in other rooms — the client-side guarantee for room isolation.

**Checkpoint**: AC-1~AC-4 now have `@covers 014/AC-n` tags.

---

## Phase 3: User Story 1 — Realtime Broadcast (AC-1~AC-4) 🎯

**Goal**: Prove that element changes propagate to other room members and are isolated by room.

**Independent Test**: `pnpm --filter whiteboard-fe test --run` passes and `@covers 014/AC-1..AC-4` tags are present.

*(Tasks T001–T003 in Phase 2 complete this story's coverage.)*

---

## Phase 4: User Story 2 — Optimistic Local Update (AC-5)

**Goal**: Prove that the store is updated before the mutation hook fires (so the UI updates immediately, before the socket emits).

**Independent Test**: The new test passes — verifying store update precedes hook invocation.

### Test for US2

> Write this FIRST; it must FAIL if the pipeline were to fire the hook before updating the store.

- [ ] T004 [US2] Write test `@covers 014/AC-5` in `frontend/src/store/__tests__/mutation-pipeline.test.ts` (create file if it does not exist): call `createElement(...)`, inside a `registerMutationHook` callback verify that `useElementsStore.getState().elements` already contains the new element when the hook fires. Expected: `elements.find(e => e.id === created.id)` is defined inside the hook. This proves the store is updated optimistically before any network emit.

**Checkpoint**: T004 passes — optimistic update is proven.

---

## Phase 5: User Story 3 — LWW Conflict Resolution (AC-6~AC-10)

**Goal**: Prove that concurrent edits resolve deterministically to the same state on all clients.

**Independent Test**: All new and tagged tests pass.

### Tag Existing Tests (AC-6~AC-9)

- [ ] T005 [P] [US3] Add `@covers 014/AC-6` to the "AC-5: higher version wins LWW" describe block in `frontend/src/sync/__tests__/apply-remote.test.ts`.
- [ ] T006 [P] [US3] Add `@covers 014/AC-7` to the "AC-6: lower version is ignored" describe block in `frontend/src/sync/__tests__/apply-remote.test.ts`.
- [ ] T007 [P] [US3] Add `@covers 014/AC-8` to the "AC-7: equal version, lower nonce wins" describe block in `frontend/src/sync/__tests__/apply-remote.test.ts`.
- [ ] T008 [P] [US3] Add `@covers 014/AC-9` to the "AC-8: equal version, higher nonce is ignored" AND "AC-8 edge: equal version and equal nonce is NOT applied" describe blocks in `frontend/src/sync/__tests__/apply-remote.test.ts`.

### New Test for AC-10 (Convergence)

- [ ] T009 [US3] Write test `@covers 014/AC-10` in `frontend/src/sync/__tests__/apply-remote.test.ts`: simulate two clients. Client A has element at x=0 (v=3, nonce=100). Client B has element at x=99 (v=3, nonce=50). Apply Client B's state to Client A via `applyRemoteElements` and Client A's state to Client B via `applyRemoteElements`. Expected: both converge to x=99 (lower nonce wins the tie) — `useElementsStore.getState().elements[0].x === 99` on both sides. This proves deterministic convergence.

**Checkpoint**: AC-6~AC-10 all have `@covers 014/AC-n` tags and pass.

---

## Phase 6: User Story 4 — Protect Local Edits in Progress (AC-11~AC-14)

**Goal**: Prove that in-progress drags, resizes, and text edits are not disrupted by remote updates, and that convergence occurs normally after interaction ends.

**Independent Test**: All new and tagged tests pass.

### Tag Existing Tests (AC-11~AC-13)

- [ ] T010 [P] [US4] Add `@covers 014/AC-11` to the "AC-9: element being dragged is not overwritten" describe block in `frontend/src/sync/__tests__/apply-remote.test.ts`.
- [ ] T011 [P] [US4] Add `@covers 014/AC-12` to the "AC-10: element being resized/rotated is not overwritten" describe block (both `it` blocks) in `frontend/src/sync/__tests__/apply-remote.test.ts`.
- [ ] T012 [P] [US4] Add `@covers 014/AC-13` to the "AC-11: element being text-edited is not overwritten" describe block in `frontend/src/sync/__tests__/apply-remote.test.ts`.

### New Test for AC-14 (Post-drag Convergence)

- [ ] T013 [US4] Write test `@covers 014/AC-14` in `frontend/src/sync/__tests__/apply-remote.test.ts`: set `draggingId = 'el-1'` in interaction store; call `applyRemoteElements` with a remote v=5 element → verify it is skipped (element stays at x=0). Then clear `draggingId` to simulate drag end; call `applyRemoteElements` again with the same remote v=5 element → verify LWW now applies it (element moves to remote position). Expected: post-drag `applyRemoteElements` correctly resolves via LWW.

**Checkpoint**: AC-11~AC-14 all have `@covers 014/AC-n` tags and pass.

---

## Phase 7: Verification

- [ ] T014 Run `pnpm --filter whiteboard-fe test --run` and confirm all tests pass (including T004, T009, T013); fix any failures by correcting implementation — never by changing expected values.
- [ ] T015 [P] Run `pnpm typecheck` across all packages and fix any TypeScript errors.
- [ ] T016 [P] Run `pnpm lint` on `frontend/` and fix any ESLint errors.

**AC Coverage summary**:
| AC   | Test task |
|------|-----------|
| AC-1 | T001 (tag on socket-client.test.ts) |
| AC-2 | T002 (tag on apply-remote.test.ts) |
| AC-3 | T002 (tag on apply-remote.test.ts) |
| AC-4 | T003 (tag on socket-client.test.ts) |
| AC-5 | T004 (new test) |
| AC-6 | T005 (tag on apply-remote.test.ts) |
| AC-7 | T006 (tag on apply-remote.test.ts) |
| AC-8 | T007 (tag on apply-remote.test.ts) |
| AC-9 | T008 (tag on apply-remote.test.ts) |
| AC-10 | T009 (new test) |
| AC-11 | T010 (tag on apply-remote.test.ts) |
| AC-12 | T011 (tag on apply-remote.test.ts) |
| AC-13 | T012 (tag on apply-remote.test.ts) |
| AC-14 | T013 (new test) |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Tagging US1)**: No dependencies — can start immediately.
- **Phase 4 (US2 — AC-5)**: No dependencies — can run in parallel with Phase 2.
- **Phase 5 (US3 — AC-6~AC-10)**: No dependencies — can run in parallel with Phases 2 & 4.
- **Phase 6 (US4 — AC-11~AC-14)**: No dependencies — can run in parallel with all prior phases.
- **Phase 7 (Verify)**: Requires all prior phases complete.

### Parallel Opportunities

```bash
# All tagging tasks and AC-5 new test can run in parallel:
T001 T002 T003        # Phase 2 (US1 tags)
T004                  # Phase 4 (AC-5 new test)
T005 T006 T007 T008   # Phase 5 (US3 tags)
T009                  # Phase 5 (AC-10 new test)
T010 T011 T012        # Phase 6 (US4 tags)
T013                  # Phase 6 (AC-14 new test)

# Then verify:
T014                  # run tests
T015 T016             # typecheck + lint (parallel)
```

---

## Implementation Strategy

### MVP (minimum to verify all ACs covered)

1. T001–T003 — tag US1 tests
2. T004 — new AC-5 test
3. T005–T009 — tag and add US3 tests
4. T010–T013 — tag and add US4 tests
5. T014 — run all tests green

### Notes

- `[P]` tasks = operate on different test blocks/files, safe to parallelize.
- All tags are additive `@covers` comments — no test logic changes.
- New tests (T004, T009, T013) derive expected values from `acceptance.md` — never from running the implementation.
- `mutation-pipeline.test.ts` may need to be created if it does not yet exist; check with `ls frontend/src/store/__tests__/` first.
