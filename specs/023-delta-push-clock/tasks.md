# Tasks: Delta Push theo Clock (P3A-04)

**Input**: Design documents from `specs/023-delta-push-clock/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Included — unit tests mentioned in quickstart.md and plan.md step 4–5.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new packages or migrations needed. This phase confirms the no-op baseline.

- [ ] T001 Verify no periodic resync timer exists — grep `backend/src/` for `setInterval`/`setTimeout` calls emitting `ROOM_RESYNC` or full element sets; confirm zero results

**Checkpoint**: Baseline verified; US1 and US2 implementation can begin.

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Add the per-room in-memory clock map in `backend/src/index.ts`. All US1/US2 tasks depend on this map existing.

- [ ] T002 Add `const roomClocks = new Map<string, number>()` at module level in `backend/src/index.ts` (parallel to existing `elements` map)

**Checkpoint**: `roomClocks` map declared — US1 and US2 implementation can now begin.

---

## Phase 3: User Story 1 — Clock advances on every ELEMENT_UPDATE batch (Priority: P1) 🎯 MVP

**Goal**: Server increments `roomClocks[roomId]` once per `ELEMENT_UPDATE` batch and broadcasts the new clock to peers.

**Independent Test**: Open two browser tabs in the same room. Move a shape in Tab A. Inspect the WS frame received by Tab B — it must carry `documentClock: N+1` where N was the clock in the initial `room-snapshot`. A second move must produce `documentClock: N+2`.

### Tests for User Story 1

> Write these tests first; confirm they FAIL before implementation (T003, T004).

- [ ] T003 [P] [US1] Add unit test in `backend/src/index.test.ts`: `ELEMENT_UPDATE` with one element emits broadcast containing `documentClock: 1` (starting from 0)
- [ ] T004 [P] [US1] Add unit test in `backend/src/index.test.ts`: two consecutive `ELEMENT_UPDATE` calls produce `documentClock: 1` then `documentClock: 2` (monotonically increasing)
- [ ] T005 [P] [US1] Add unit test in `backend/src/index.test.ts`: `ELEMENT_UPDATE` with a batch of 3 elements increments `documentClock` by exactly 1 (not 3)

### Implementation for User Story 1

- [ ] T006 [US1] In the `JOIN_ROOM` handler cold path in `backend/src/index.ts`: after loading room from DB, set `roomClocks.set(roomId, loaded.documentClock)` (depends on T002)
- [ ] T007 [US1] In the `JOIN_ROOM` handler warm path in `backend/src/index.ts`: if `!roomClocks.has(roomId)`, set `roomClocks.set(roomId, await getRoomClock(db, roomId))` (depends on T002)
- [ ] T008 [US1] In the `ELEMENT_UPDATE` handler in `backend/src/index.ts`: compute `const newClock = (roomClocks.get(roomId) ?? 0) + 1; roomClocks.set(roomId, newClock);` before the broadcast (depends on T002)
- [ ] T009 [US1] Update the `socket.to(roomId).emit(WS_EVENTS.ELEMENT_UPDATE, ...)` call in `backend/src/index.ts` to include `documentClock: newClock` in the payload (depends on T008)
- [ ] T010 [US1] In the disconnect/room-teardown path in `backend/src/index.ts`: add `roomClocks.delete(roomId)` alongside `elements.delete(roomId)` when the last client leaves (depends on T002)

**Checkpoint**: Run `pnpm test` — T003, T004, T005 must now pass. Manual check: WS frame in Tab B shows `documentClock`.

---

## Phase 4: User Story 2 — Client tracks `lastServerClock` from broadcasts (Priority: P1)

**Goal**: `_lastServerClock` in `socket-client.ts` is updated on every received `ELEMENT_UPDATE` that carries `documentClock`, so reconnect diffs use the correct starting clock.

**Independent Test**: After Tab A makes an edit, call `getLastServerClock()` in Tab B's console — it must equal the `documentClock` value seen in the `ELEMENT_UPDATE` WS frame, not the original snapshot clock.

### Tests for User Story 2

> Write these tests first; confirm they FAIL before implementation (T011, T012).

- [ ] T011 [P] [US2] Add unit test in `frontend/src/sync/__tests__/socket-client.test.ts`: receiving `ELEMENT_UPDATE` with `documentClock: 7` causes `getLastServerClock()` to return `7`
- [ ] T012 [P] [US2] Add unit test in `frontend/src/sync/__tests__/socket-client.test.ts`: receiving `ELEMENT_UPDATE` without `documentClock` field leaves `getLastServerClock()` unchanged (backward-compat guard)

### Implementation for User Story 2

- [ ] T013 [US2] Widen the `ELEMENT_UPDATE` listener payload type in `frontend/src/sync/socket-client.ts` from `{ elements: Element[]; sessionId?: string }` to `{ elements: Element[]; sessionId?: string; documentClock?: number }`
- [ ] T014 [US2] In the `ELEMENT_UPDATE` listener body in `frontend/src/sync/socket-client.ts`: add `if (data.documentClock !== undefined) _lastServerClock = data.documentClock;` immediately after `applyRemoteElements` (depends on T013)

**Checkpoint**: Run `pnpm test` — T011, T012 must now pass. Manual check: `getLastServerClock()` returns the clock from the latest peer edit.

---

## Phase 5: User Story 3 — No periodic full-resync (Priority: P2)

**Goal**: Confirm and enforce that no timer-based full-resync mechanism exists in the codebase.

**Independent Test**: Grep backend source for timer-based resync; leave two tabs idle for 60 seconds; confirm no unsolicited `element-update` or `room-resync` WS frames appear.

### Tests for User Story 3

- [ ] T015 [US3] Add unit test in `backend/src/index.test.ts`: after room initialisation and 30+ seconds of idle time, assert that no `ROOM_RESYNC` event was emitted (use fake timers)

### Implementation for User Story 3

- [ ] T016 [US3] Run `grep -rn "setInterval\|ROOM_RESYNC" backend/src/` and confirm no periodic emit of full element sets exists — document finding as a comment in `specs/023-delta-push-clock/research.md` under D-06 if needed

**Checkpoint**: T015 passes. Idle WS inspection shows no unsolicited frames.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T017 [P] Run `pnpm typecheck` across the monorepo and fix any type errors introduced by the `documentClock?: number` payload widening
- [ ] T018 [P] Run `pnpm lint` across the monorepo and fix any ESLint errors
- [ ] T019 Run full test suite with `pnpm test` — all tests must pass
- [ ] T020 Validate manually using `quickstart.md` Scenarios 1–4

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS Phase 3 and 4
- **Phase 3 (US1)**: Depends on Phase 2 — tests T003–T005 can be written in parallel with T002
- **Phase 4 (US2)**: Depends on Phase 2 — tests T011–T012 can be written in parallel with Phase 3
- **Phase 5 (US3)**: Independent — can run in parallel with Phase 3 and 4
- **Phase 6 (Polish)**: Depends on Phases 3, 4, 5

### User Story Dependencies

- **US1**: Depends on `roomClocks` map (T002) — no dependency on US2 or US3
- **US2**: Depends on `roomClocks` map (T002) indirectly (server must send clock before client can track it) — best started after US1 T009 lands, but tests can be written in parallel
- **US3**: Fully independent — verifies absence of a mechanism

### Within Each User Story

- Tests (T003–T005, T011–T012) MUST be written first and confirmed FAILING
- T002 (roomClocks declaration) must precede T006–T010
- T008 must precede T009 (increment before broadcast)
- T013 must precede T014 (type widening before usage)

---

## Parallel Opportunities

```bash
# After T002, these can run simultaneously:
Task: T003 — backend clock test (index.test.ts)
Task: T004 — backend monotonic test (index.test.ts)
Task: T005 — backend batch test (index.test.ts)
Task: T011 — frontend clock update test (socket-client.test.ts)
Task: T012 — frontend backward-compat test (socket-client.test.ts)

# US1 impl tasks run sequentially: T006 → T007 → T008 → T009 → T010
# US2 impl tasks run sequentially: T013 → T014

# Polish tasks are fully parallel:
Task: T017 — typecheck
Task: T018 — lint
```

---

## Implementation Strategy

### MVP First (US1 + US2 — both P1)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002)
3. Complete Phase 3: US1 (T003–T010)
4. **STOP and VALIDATE**: `pnpm test` passes; WS frame in peer tab shows `documentClock`
5. Complete Phase 4: US2 (T011–T014)
6. **STOP and VALIDATE**: `getLastServerClock()` reflects peer updates

### Incremental Delivery

1. T001–T002 → infrastructure ready
2. T003–T010 → server-side clock works, peers see `documentClock`
3. T011–T014 → clients track clock correctly; reconnect diffs will use accurate `lastServerClock`
4. T015–T016 → no-resync invariant asserted
5. T017–T020 → polish complete

---

## Notes

- [P] tasks touch different files and have no inter-task dependency
- Test tasks (T003–T005, T011–T012, T015) must FAIL before their corresponding implementation tasks
- `backend/src/index.test.ts` may not exist yet — create it if needed, following the pattern in `backend/src/persistence/*.test.ts`
- No new npm packages, migrations, or shared-type changes are required
