# Tasks: PostgreSQL Prisma Autosave

**Input**: Design documents from `specs/021-postgresql-prisma-autosave/`

**Prerequisites**: plan.md, spec.md, acceptance.md, research.md, data-model.md, contracts/

**Tests**: Required. One or more test tasks must cover every AC-n from `acceptance.md` with
`@covers AC-n` comments.

**Organization**: Tasks are grouped by independently testable backend user stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete sibling tasks)
- **[Story]**: Which user story this task belongs to ([US1]-[US4])
- Exact file paths are required in every description

---

## Phase 1: Setup

**Purpose**: Add backend persistence tooling without changing runtime behavior yet.

- [ ] T001 Add Prisma, `@prisma/client`, Vitest test tooling, and backend scripts (`prisma`, `test`, optional `test:run`) in `backend/package.json`
- [ ] T002 Create `backend/prisma/schema.prisma` with `Room`, `RoomMember`, `Record`, and `Tombstone` models exactly matching SPECS.md Section 2.5
- [ ] T003 Add backend Vitest config in `backend/vitest.config.ts` or package-level test config so backend unit tests run under Node with TypeScript
- [ ] T004 [P] Add shared backend element fixtures in `backend/src/test/element-fixtures.ts`

**Checkpoint**: `pnpm --filter whiteboard-be prisma generate` succeeds.

---

## Phase 2: Foundational Persistence Layer

**Purpose**: Implement durable write semantics before wiring autosave into sockets.

- [ ] T005 Create Prisma client singleton in `backend/src/persistence/prisma.ts`
- [ ] T006 Implement `saveRoomElements(roomId, elements)` transaction in `backend/src/persistence/room-repository.ts`
- [ ] T007 [P] [US1] Write repository tests in `backend/src/persistence/room-repository.test.ts` tagged `@covers AC-1` and `@covers AC-2` for room creation, active record upsert, single transaction clock increment, and shared `recordClock`
- [ ] T008 [P] [US2] Extend `backend/src/persistence/room-repository.test.ts` with `@covers AC-3` and `@covers AC-4` tests for deleted-element tombstones and tombstone clearing on later active save
- [ ] T009 [P] Extend `backend/src/persistence/room-repository.test.ts` with `@covers AC-9` for empty batch / clean flush behavior and `@covers AC-10` for failed transaction dirty-state expectations at repository boundary

**Checkpoint**: Repository tests pass and AC-1, AC-2, AC-3, AC-4, AC-9, AC-10 have coverage tags.

---

## Phase 3: User Story 3 - Autosave timing (Priority: P2)

**Goal**: Dirty rooms batch writes during active editing and flush immediately when empty.

**Independent Test**: Fake timers prove scheduling, delayed flush, immediate empty-room flush, and failure retry behavior.

- [ ] T010 Implement `createAutosaveManager` in `backend/src/persistence/autosave.ts` with configurable delay, dirty room tracking, timer clearing, in-flight guard, and injected `getRoomElements` / `saveRoomElements` dependencies
- [ ] T011 [P] [US3] Create `backend/src/persistence/autosave.test.ts` with fake-timer tests tagged `@covers AC-5` and `@covers AC-6` for no flush before 5 seconds, one flush after delay, latest-state flush, and clean-on-success
- [ ] T012 [P] [US3] Extend `backend/src/persistence/autosave.test.ts` with `@covers AC-7` for `flushRoomNow` clearing the timer and persisting immediately when a room becomes empty
- [ ] T013 [US3] Extend `backend/src/persistence/autosave.test.ts` with `@covers AC-10` for failed flush logging, dirty-state preservation, and later retry

**Checkpoint**: Autosave tests pass and AC-5, AC-6, AC-7, AC-10 have coverage tags.

---

## Phase 4: User Story 4 - Hot path remains in memory (Priority: P2)

**Goal**: Socket realtime behavior remains responsive while autosave runs in the background.

**Independent Test**: Mock slow persistence and assert broadcast is emitted without awaiting the database write.

- [ ] T014 Refactor backend socket setup in `backend/src/index.ts` to create injectable room state helpers or an exported `createWhiteboardServer` test seam without changing public socket behavior
- [ ] T015 Wire autosave into `backend/src/index.ts`: after `roomElements` is updated on `element-update`, call `autosave.markDirty(roomId)` before or alongside the existing broadcast; do not await database persistence
- [ ] T016 Wire empty-room flush in `backend/src/index.ts`: when disconnect cleanup removes the final presence entry for a room, call `autosave.flushRoomNow(roomId)` and handle/log rejected promises
- [ ] T017 [P] [US4] Create `backend/src/persistence/socket-autosave.test.ts` tagged `@covers AC-8` proving `element-update` updates in-memory state and broadcasts to peers even when persistence is mocked as slow or pending

**Checkpoint**: Socket autosave test passes and existing P2 socket behavior is unchanged.

---

## Phase 5: Verification and AC Coverage

**Purpose**: Prove all acceptance criteria are covered and the backend remains type-safe.

- [ ] T018 Run `.agents/skills/implement-feature/scripts/check-ac-coverage.sh specs/021-postgresql-prisma-autosave/acceptance.md backend/src` and fix missing `@covers AC-n` tags, including `@covers AC-11`
- [ ] T019 Run `pnpm --filter whiteboard-be test --run` and fix any backend test failures without changing AC oracles
- [ ] T020 Run `pnpm --filter whiteboard-be typecheck` and fix TypeScript errors
- [ ] T021 Run `pnpm typecheck` from repo root and fix workspace type errors
- [ ] T022 Run `pnpm lint` from repo root and fix lint errors in touched files

**AC Coverage summary**:

| AC | Test task |
|----|-----------|
| AC-1 | T007 |
| AC-2 | T007 |
| AC-3 | T008 |
| AC-4 | T008 |
| AC-5 | T011 |
| AC-6 | T011 |
| AC-7 | T012 |
| AC-8 | T017 |
| AC-9 | T009 |
| AC-10 | T009, T013 |
| AC-11 | T018 |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational Persistence (Phase 2)**: Depends on Prisma schema/client setup.
- **Autosave Timing (Phase 3)**: Depends on repository contract shape but can use mocks.
- **Socket Wiring (Phase 4)**: Depends on autosave manager API.
- **Verification (Phase 5)**: Depends on all implementation/test tasks.

### Parallel Opportunities

| Group | Tasks | Notes |
|-------|-------|-------|
| Setup | T002, T003, T004 | Different files after package dependency decision. |
| Repository tests | T007, T008, T009 | Same test file, can be authored as separate describe blocks but final edit is sequential. |
| Autosave tests | T011, T012 | Same test file, independent cases after T010. |
| Verification | T019, T020 | Can run separately once implementation is complete. |

## Implementation Strategy

1. Complete Phase 1 and generate Prisma client.
2. Build and test repository transaction semantics (AC-1 through AC-4, AC-9, AC-10).
3. Build and test autosave timing (AC-5 through AC-7, AC-10).
4. Wire Socket.IO hot path and empty-room flush (AC-8).
5. Run AC coverage guard, backend tests, typecheck, and lint.
