# Tasks: Load Room on Join

**Input**: Design documents from `specs/022-load-room-on-join/`

**Prerequisites**: plan.md, spec.md, acceptance.md, research.md, data-model.md, contracts/

**Tests**: Required. One or more test tasks must cover every AC-n from `acceptance.md` with
`@covers AC-n` comments.

**Organization**: Tasks are grouped by independently testable layers. P3A-01 is complete;
no new schema migrations or tooling setup is needed.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete sibling tasks)
- **[Story]**: Which user story this task belongs to ([US1]-[US3])
- Exact file paths are required in every description

---

## Phase 1: Foundational — Repository Load Functions

**Purpose**: Add the two read-only DB query functions that both backend join paths depend on.
These must be complete before any socket wiring or test tasks can start.

- [x] T001 Add `loadRoomElements(db, roomId): Promise<{ elements: Element[]; documentClock: number }>` to `backend/src/persistence/room-repository.ts` — uses `db.room.findUnique` with `include: { records: true }`; returns `{ elements: [], documentClock: 0 }` when room not found; converts BigInt clock to `Number()` at boundary
- [x] T002 Add `getRoomClock(db, roomId): Promise<number>` to `backend/src/persistence/room-repository.ts` — uses `db.room.findUnique` select `documentClock` only; returns `0` when room not found; converts BigInt to `Number()`

**Checkpoint**: `pnpm --filter whiteboard-be typecheck` passes on the repository file.

---

## Phase 2: User Stories 1 & 2 — Backend Cold Load & Empty Room (Priority: P1)

**Goal**: Server correctly loads persisted elements from DB on first join and sends accurate
`documentClock` in both cold and warm join paths.

**Independent Test**: Mock Prisma client returning records → assert `loadRoomElements` returns
correct `Element[]` and `documentClock`; mock empty DB → assert `{ elements: [], documentClock: 0 }`.

- [x] T003 [P] [US1] Write `room-repository.test.ts` tests for `loadRoomElements` with a mocked room containing active records — assert elements deserialized from `state` JSON and `documentClock` equals `Number(room.documentClock)`; tag `@covers AC-1` in `backend/src/persistence/room-repository.test.ts`
- [x] T004 [P] [US2] Extend `backend/src/persistence/room-repository.test.ts` with test for `loadRoomElements` when room does not exist in DB — assert `{ elements: [], documentClock: 0 }`; tag `@covers AC-3`
- [x] T005 [P] [US1] Extend `backend/src/persistence/room-repository.test.ts` with test for `loadRoomElements` when all records are tombstoned (room exists, `records: []`) — assert `{ elements: [], documentClock: N }` where `N > 0`; tag `@covers AC-6`
- [x] T006 [P] [US1] Extend `backend/src/persistence/room-repository.test.ts` with test that `loadRoomElements` result has `documentClock` typed as `number` (not `bigint`) — tag `@covers AC-8`
- [x] T007 Wire `JOIN_ROOM` handler in `backend/src/index.ts` (inside `createWhiteboardServer`): **cold path** (room absent or empty in `elements` map) → call `loadRoomElements(prisma, roomId)` to get both elements and documentClock, populate in-memory map from returned elements; **warm path** (room has elements in memory, size > 0) → call `getRoomClock(prisma, roomId)` only (do NOT reload elements); wrap entire DB block in `try/catch` (log error, fallback documentClock = 0); emit `ROOM_SNAPSHOT { elements: [...map.values()], documentClock }` and preserve existing `USER_JOIN` broadcast and presence registration logic unchanged
- [x] T008 [P] [US1] Create `backend/src/persistence/socket-join.test.ts`; write tests: (a) cold-path join emits `ROOM_SNAPSHOT` with elements and clock from `loadRoomElements`; (b) warm-path join does NOT call `loadRoomElements` again (spy assertion), calls `getRoomClock`, emits `ROOM_SNAPSHOT`; tag `@covers AC-2` on the warm-path test
- [x] T009 [P] [US2] Extend backend socket test with `loadRoomElements` mocked to return empty — assert `ROOM_SNAPSHOT { elements: [], documentClock: 0 }`; tag `@covers AC-3` (corroborating socket-layer coverage)
- [x] T010 [P] [US1] Extend backend socket test to verify DB error path: mock `loadRoomElements` to throw; assert server does NOT throw, still emits `ROOM_SNAPSHOT` (possibly `{ elements: [], documentClock: 0 }`), and the `USER_JOIN` broadcast still fires; tag `@covers AC-7`

**Checkpoint**: `pnpm --filter whiteboard-be test --run` passes and AC-1, AC-2, AC-3, AC-6, AC-7, AC-8 have coverage tags.

---

## Phase 3: User Story 3 — Frontend Snapshot Handler & Clock Tracking (Priority: P1)

**Goal**: Client applies snapshot via `applyRemoteElements` and tracks `lastServerClock`.

**Independent Test**: Pass mocked `ROOM_SNAPSHOT` payload to handler; assert `applyRemoteElements`
called with elements; assert `getLastServerClock()` returns the received clock.

- [x] T011 Add `let _lastServerClock = 0` module-level state and `export function getLastServerClock(): number` accessor to `frontend/src/sync/socket-client.ts`; also reset `_lastServerClock = 0` in `stopSocketClient()`
- [x] T012 Update `ROOM_SNAPSHOT` handler in `frontend/src/sync/socket-client.ts`: change type annotation to `{ elements: Element[]; documentClock: number }`, replace `useElementsStore.getState().setElements(data.elements)` with `applyRemoteElements(data.elements)`, add `_lastServerClock = data.documentClock`
- [x] T013 [P] [US3] Write frontend test in `frontend/src/sync/__tests__/socket-client.test.ts` that simulates receiving `ROOM_SNAPSHOT { elements: [el], documentClock: 5 }` — assert `applyRemoteElements` was called with the element array and `getLastServerClock()` returns `5`; tag `@covers AC-4`
- [x] T014 [P] [US3] Extend `frontend/src/sync/__tests__/socket-client.test.ts` with test for empty snapshot `{ elements: [], documentClock: 0 }` — assert element store unchanged and `getLastServerClock()` returns `0`; tag `@covers AC-5`

**Checkpoint**: `pnpm --filter whiteboard-fe test --run` passes and AC-4, AC-5 have coverage tags.

---

## Phase 4: Verification and Cleanup

**Purpose**: Prove all acceptance criteria are covered and both packages remain type-safe and clean.

- [x] T015 Run `pnpm --filter whiteboard-be test --run` and fix any backend test failures without changing AC oracles; verify `@covers AC-1`, `@covers AC-2`, `@covers AC-3`, `@covers AC-6`, `@covers AC-7`, `@covers AC-8` comment strings appear in backend test files
- [x] T016 Run `pnpm --filter whiteboard-fe test --run` and fix any frontend test failures without changing AC oracles
- [x] T017 Run `pnpm typecheck` from repo root and fix TypeScript errors in all touched files
- [x] T018 Run `pnpm lint` from repo root and fix lint errors in touched files

**AC Coverage summary**:

| AC | Test task |
|----|-----------|
| AC-1 | T003 |
| AC-2 | T008 |
| AC-3 | T004, T009 |
| AC-4 | T013 |
| AC-5 | T014 |
| AC-6 | T005 |
| AC-7 | T010 |
| AC-8 | T006 |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (T001–T002)**: No dependencies — start here.
- **Phase 2 backend (T003–T010)**: T001, T002 must be complete.
- **Phase 3 frontend (T011–T014)**: Independent of Phase 2 — can run in parallel with Phase 2 after Phase 1.
- **Phase 4 verification (T015–T018)**: All implementation and test tasks must be complete.

### Parallel Opportunities

| Group | Tasks | Notes |
|-------|-------|-------|
| Repository functions | T001, T002 | Same file — author sequentially |
| Repository tests | T003, T004, T005, T006 | Same test file — author as separate describe blocks |
| Socket tests | T008, T009, T010 | Can coexist in one test file |
| Frontend | T011+T012, T013+T014 | T011 before T012 (same file); T013/T014 after T012 |
| Backend + Frontend | Phase 2 and Phase 3 | Independent layers — run concurrently after Phase 1 |

## Implementation Strategy

1. Complete Phase 1 (T001, T002) — repository functions first, typecheck passes.
2. Wire backend `JOIN_ROOM` handler (T007) and write backend tests (T003–T006, T008–T010) — AC-1 through AC-3, AC-6, AC-7, AC-8 covered.
3. Concurrently update frontend socket client (T011, T012) and write frontend tests (T013, T014) — AC-4, AC-5 covered.
4. Run full verification (T015–T018).
