# Tasks: Reconnect Without Data Loss (P3A-03)

**Input**: Design documents from `specs/024-reconnect-diff/`

**Organization**: Tasks grouped by user story — each story is independently testable.

**Tests**: AC-coverage tests included (each AC maps to at least one automated test).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared write dependencies)
- **[Story]**: User story tag ([US1] = incremental diff, [US2] = pending replay, [US3] = wipe-all)

---

## Phase 1: Setup — Shared Types

**Purpose**: Extend the shared type contract so both packages can compile against the new event constant.

- [x] T001 Add `ROOM_DIFF: 'room-diff'` to the `WS_EVENTS` object in `packages/shared/src/index.ts`; keep it alphabetically ordered with existing constants.
- [x] T001a Add a shared whole-element LWW comparator to `packages/shared/src/index.ts`: higher
  `version` wins; when versions tie, lower `versionNonce` wins. Frontend and backend must import
  this helper rather than duplicating comparator logic.

**Checkpoint**: `pnpm typecheck` passes from root (no new import errors in backend or frontend).

---

## Phase 2: Foundational — getRoomDiff Repository Function

**Purpose**: Backend query function that powers the reconnect-diff path. All US1/US3 backend work depends on this.

**⚠️ CRITICAL**: Must be complete before JOIN_ROOM handler changes (T004) and backend tests (T007, T014).

- [x] T002 Add `getRoomDiff(db, roomId, lastServerClock, inMemoryElements)` to `backend/src/persistence/room-repository.ts`:
  - Compute `tombstoneHistoryStartsAtClock` = MIN(`tombstone.deletedClock`) across all tombstones for `roomId` using a Prisma aggregate query (`_min: { deletedClock: true }`); if no tombstones, treat as `+Infinity`.
  - If `lastServerClock < tombstoneHistoryStartsAtClock`: return `{ mode: 'wipe', elements: [...inMemoryElements.filter(e => !e.isDeleted)], documentClock }` where documentClock comes from the in-memory snapshot (caller passes current room clock).
  - Else: query DB for `changed` = `Record` rows where `roomId = roomId AND recordClock > lastServerClock` (order by `recordClock` asc); query DB for `deleted` = `Tombstone` rows where `roomId = roomId AND deletedClock > lastServerClock` (projection: `{ recordId }` only). Overlay in-memory elements that are NOT already in the DB `changed` result set (by element ID) AND have `isDeleted = false` (in-memory deletions before autosave are NOT included in `changed`; they remain invisible until autosaved as tombstones — this is acceptable since the reconnect diff is best-effort for pre-autosave writes). Fetch `documentClock` from DB via `Room.documentClock` (A2 note: the caller must ensure this is populated by `loadRoomElements` before the first reconnect, which P3A-02 already guarantees). Return `{ mode: 'diff', changed: Element[], deleted: Array<{id: string}>, documentClock: number }`.
  - Export type alias `RoomDiffResult` for the union return type.
  - Convert BigInt fields to `number` at the boundary (same pattern as `loadRoomElements`).
  - Annotate the file with relevant `// AC-N` tags.

- [x] T003 Add `getRoomDiff` unit tests to `backend/src/persistence/room-repository.test.ts`:
  - Empty room (no records, no tombstones) → `{ mode: 'diff', changed: [], deleted: [], documentClock: 0 }` (AC-10).
  - Room with records and no tombstones, `lastServerClock = N` → `changed` contains only records with `recordClock > N` (AC-1 basic).
  - Room with tombstones, `lastServerClock >= MIN(deletedClock)` → diff mode, `deleted` contains only tombstones with `deletedClock > lastServerClock` (AC-1, AC-2).
  - Room with tombstones, `lastServerClock < MIN(deletedClock)` → wipe mode (AC-8).
  - In-memory overlay: provide an in-memory element not yet in DB → appears in `changed` (R-03 research).
  - Tag each test block with the relevant `// AC-N` marker.

**Checkpoint**: `pnpm --filter whiteboard-be test` passes with all T003 tests green.

---

## Phase 3: User Story 1 — Reconnect Receives Incremental Diff (Priority: P1) 🎯 MVP

**Goal**: A client that reconnects after a brief offline period receives only the elements that changed while it was away, not a full room snapshot.

**Independent Test**: Open two tabs, take Tab B offline, make edits in Tab A, bring Tab B back online — Tab B receives a `ROOM_DIFF` event (not `ROOM_SNAPSHOT`) and its canvas converges to Tab A's state.

- [x] T004 Extend `JOIN_ROOM` handler in `backend/src/index.ts`:
  - Expand payload type to include `lastServerClock?: number`.
  - If `lastServerClock` is present and `> 0`: load in-memory elements for the room (existing `roomElements.get(roomId)` map), call `getRoomDiff(db, roomId, lastServerClock, [...roomMap.values()])`, then:
    - On `mode === 'diff'`: `socket.emit(WS_EVENTS.ROOM_DIFF, { changed, deleted, documentClock })`.
    - On `mode === 'wipe'`: `socket.emit(WS_EVENTS.ROOM_SNAPSHOT, { elements: result.elements, documentClock: result.documentClock })` (same event as initial join).
  - If `lastServerClock` is absent or `=== 0`: keep existing behavior (full snapshot via `loadRoomElements`).
  - Do NOT move or duplicate the presence registration or `USER_JOIN` broadcast — those still run unconditionally.
  - Tag with `// AC-1`, `// AC-4`, `// AC-8`, `// AC-12`.

- [x] T005 Refactor `initSocketClient` in `frontend/src/sync/socket-client.ts` to use a `connect` event listener:
  - Add module-level `let _hasJoined = false` and `let _reconnectPending = false`.
  - Remove the synchronous `_socket.emit(WS_EVENTS.JOIN_ROOM, ...)` line that fires immediately after `io(SERVER_URL)`.
  - Add `_socket.on('connect', () => { ... })` that emits JOIN_ROOM with:
    - `lastServerClock: _hasJoined ? _lastServerClock : 0` (initial join sends 0; reconnect sends actual clock).
    - If `_hasJoined`: also set `_reconnectPending = true`.
    - Always set `_hasJoined = true` after emitting.
  - All other fields (`roomId`, `sessionId`, `name`, `color`) stay the same.

- [x] T006 Register `ROOM_DIFF` handler in `frontend/src/sync/socket-client.ts` (inside `initSocketClient`, after the `ROOM_SNAPSHOT` handler):
  ```ts
  _socket.on(WS_EVENTS.ROOM_DIFF, (data: { changed: Element[]; deleted: Array<{id: string}>; documentClock: number }) => {
    _lastServerClock = data.documentClock;
    applyRemoteElements(data.changed);
    useElementsStore.getState().removeElements(data.deleted.map((d) => d.id));
    _reconnectPending = false;
    // pending queue replay added in T011
  });
  ```
  - Tag with `// AC-2`, `// AC-3`, `// AC-11`, `// AC-12`.

- [x] T007 [P] Add integration tests for the `JOIN_ROOM` reconnect path in `backend/src/persistence/socket-reconnect.test.ts` (new file; `createWhiteboardServer` is exported from `backend/src/index.ts` and accepts injected `roomElements` and `db`):
  - Set up a test room with some elements, use `createWhiteboardServer` test seam with injected `roomElements` and `db`.
  - Reconnect scenario with `lastServerClock = N` and changed elements since N → server emits `ROOM_DIFF` with only the diff (AC-1).
  - Reconnect with `lastServerClock = 0` → server emits `ROOM_SNAPSHOT` (AC-4).
  - Reconnect with elements deleted since N → `ROOM_DIFF.deleted` contains those IDs (AC-2).
  - Wipe-all scenario → server emits `ROOM_SNAPSHOT` with full element set (AC-8 integration layer).

- [x] T008 [P] Add `ROOM_DIFF` handler tests in `frontend/src/sync/__tests__/socket-client.test.ts`:
  - `ROOM_DIFF` received → `applyRemoteElements` called with `changed` (AC-3).
  - `ROOM_DIFF` received → `removeElements` called with deleted IDs (AC-2).
  - `ROOM_DIFF` received → `_lastServerClock` updated to `documentClock` (AC-11).
  - `ROOM_DIFF` event is wired separately from `ROOM_SNAPSHOT` — they are distinct socket events (AC-12).

**Checkpoint**: All tests green. Two-tab manual test matches Scenario 1 in `quickstart.md`.

---

## Phase 4: User Story 2 — Pending Local Changes Replayed (Priority: P1)

**Goal**: Mutations made while offline are queued and re-emitted after the server diff is applied, so no offline work is silently lost.

**Independent Test**: Disconnect Tab B, move an element in Tab B, reconnect — the element movement appears on Tab A within ~1 second.

- [x] T009 Add `let _pendingQueue: Element[] = []` module-level variable to `frontend/src/sync/socket-client.ts`. Note (U1): guarding `_socket.emit` with the `connected` check prevents Socket.IO from ever buffering our mutations internally — the buffer only activates for events where `emit` is actually called while disconnected. No additional Socket.IO config is required.

- [x] T010 Guard the mutation hook emit in `frontend/src/sync/socket-client.ts`:
  - In `registerMutationHook` callback, change:
    ```ts
    _socket.emit(WS_EVENTS.ELEMENT_UPDATE, { roomId, elements: event.elements });
    ```
    to:
    ```ts
    if (_socket?.connected) {
      _socket.emit(WS_EVENTS.ELEMENT_UPDATE, { roomId, elements: event.elements });
    } else {
      _pendingQueue = [..._pendingQueue, ...event.elements];
    }
    ```
  - Tag with `// AC-5`, `// AC-6`.

- [x] T011 After applying `ROOM_DIFF` in the handler added in T006, replay the pending queue:
  ```ts
  if (_pendingQueue.length > 0 && _socket && roomId) {
    _socket.emit(WS_EVENTS.ELEMENT_UPDATE, { roomId, elements: _pendingQueue });
    _pendingQueue = [];
  }
  ```
  Insert this block at the end of the ROOM_DIFF handler (after `_reconnectPending = false`). Tag with `// AC-5`.

- [x] T012 Handle wipe-all ROOM_SNAPSHOT on reconnect: update the existing `ROOM_SNAPSHOT` handler in `frontend/src/sync/socket-client.ts` to:
  ```ts
  _socket.on(WS_EVENTS.ROOM_SNAPSHOT, (data: { elements: Element[]; documentClock: number }) => {
    _lastServerClock = data.documentClock;
    applyRemoteElements(data.elements);
    if (_reconnectPending) {
      // Wipe-all path: server sent full snapshot — discard pending queue (US3 safety fallback; FR-008 only requires replay for ROOM_DIFF, not ROOM_SNAPSHOT)
      _pendingQueue = [];
      _reconnectPending = false;
    }
  });
  ```
  Tag with `// AC-9`.

- [x] T013 Extend `stopSocketClient` in `frontend/src/sync/socket-client.ts` to reset new state:
  ```ts
  _pendingQueue = [];
  _hasJoined = false;
  _reconnectPending = false;
  ```
  Add these resets alongside the existing `_lastServerClock = 0` reset.

- [x] T014 Add pending queue unit tests in `frontend/src/sync/__tests__/socket-client.test.ts`:
  - Mutation while socket disconnected → element added to `_pendingQueue`; `ELEMENT_UPDATE` NOT emitted (AC-6).
  - After `ROOM_DIFF` applied → `ELEMENT_UPDATE` emitted with queued elements; queue cleared (AC-5).
  - After wipe-all `ROOM_SNAPSHOT` while reconnecting → queue cleared; no `ELEMENT_UPDATE` emitted (spec FR-008).
  - No pending changes → `ROOM_DIFF` handled without any `ELEMENT_UPDATE` emitted (AC-6).
  - AC-7 (LWW conflict): Simulate ROOM_DIFF carrying element X at version 5; `_pendingQueue` contains element X at version 7 (higher). After diff applied, replay emits version 7. Backend `ELEMENT_UPDATE` handling applies the same shared comparator and commits only elements that beat current hot state. Verify that no queue item is silently dropped by the client.

- [x] T014a Update backend `ELEMENT_UPDATE` handling in `backend/src/index.ts` to import the
  shared comparator and accept only new/winning elements into `roomElements`; broadcast only the
  accepted subset; if the accepted subset is empty, do not advance `documentClock` and do not mark
  the room dirty.

- [x] T014b Add backend tests proving same-version lower nonce wins, same-version higher nonce is
  discarded without clock advancement, and mixed batches broadcast only accepted elements.

**Checkpoint**: All tests green. Manual Scenario 2 in `quickstart.md` validated.

---

## Phase 5: User Story 3 — Wipe-all Fallback (Priority: P2)

**Goal**: When tombstone history is insufficient, the server falls back to a full snapshot, leaving the reconnected client in a correct, ghost-free state.

**Independent Test**: Force a wipe-all condition (tombstone deletedClock > lastServerClock); reconnect; confirm the canvas is identical to a fresh join.

- [x] T015 [P] Add wipe-all integration tests in `backend/src/persistence/socket-reconnect.test.ts` (same file as T007):
  - Room has tombstones with MIN `deletedClock = 8`; client reconnects with `lastServerClock = 5`; server emits `ROOM_SNAPSHOT` (not `ROOM_DIFF`) with full element list (AC-8).
  - Wipe-all response contains all currently active room elements — identical to a fresh join snapshot (AC-9).

- [x] T016 [P] Add no-tombstone diff test in `backend/src/persistence/socket-reconnect.test.ts`:
  - Room has multiple records but zero tombstones; client reconnects with any `lastServerClock >= 0`; server emits `ROOM_DIFF` (AC-10).

**Checkpoint**: All tests green. AC-8, AC-9, AC-10 fully verified by automated tests.

---

## Phase 6: Polish & Validation

- [x] T017 Run `pnpm typecheck` from repo root; fix any TypeScript errors introduced by new types or payload shapes.
- [x] T018 Run `pnpm test` from repo root; confirm all existing and new tests pass with zero failures.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (T001)**: No dependencies — start immediately.
- **Phase 2 (T002, T003)**: Depends on T001 — BLOCKS T004, T007, T014, T015.
- **Phase 3 (T004–T008)**: Depends on Phase 2 — backend (T004, T007) and frontend (T005, T006, T008) can proceed in parallel after T002.
- **Phase 4 (T009–T014)**: Depends on T005, T006 (same file) — sequential within `socket-client.ts`.
- **Phase 5 (T015, T016)**: Depends on T004 — can run in parallel with Phase 4.
- **Phase 6 (T017, T018)**: Depends on all implementation tasks complete.

### User Story Dependencies

- **US1 (P1)**: Foundational phase complete → backend (T004) and frontend (T005, T006) can be done in any order.
- **US2 (P1)**: US1 frontend tasks (T005, T006) must be complete (same file); backend US1 (T004) not needed.
- **US3 (P2)**: getRoomDiff (T002) covers the diff logic; T015/T016 only add test coverage.

### Within Each Phase

- Same-file changes (T005 → T006 → T010 → T011 → T012 → T013): sequential.
- Different-file changes in same phase: parallel where marked [P].

---

## Parallel Execution Examples

### During Phase 3

```text
Parallel track A (backend):
  T004 — backend JOIN_ROOM handler
  T007 — backend integration tests

Parallel track B (frontend, sequential within file):
  T005 → T006 → T008
```

### During Phase 5

```text
T015 — wipe-all integration tests
T016 — no-tombstone diff test
(both touch the same test file but add separate describe blocks — coordinate if pair-programming)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only — P1)

1. T001 → T002 → T003 (foundation)
2. T004 + T005 + T006 (wire-up, parallel where possible)
3. T007 + T008 (tests)
4. T009 → T010 → T011 → T012 → T013 → T014 (pending queue)
5. **VALIDATE**: Run `pnpm test`; confirm Scenario 1 + 2 from `quickstart.md`.

### Full Delivery (All User Stories)

Add Phase 5 (T015, T016) after Phase 4 completes for full AC coverage including wipe-all.

---

## Notes

- `[P]` = different files or non-overlapping test describe blocks; safe to parallelize.
- Every task maps to at least one `AC-N` tag — check `acceptance.md` for the full registry.
- Commit after each phase (or after T002 + T005-T006 as a logical group).
- `pnpm typecheck` after T001 to catch import errors early.
- The `createWhiteboardServer` test seam (already in `backend/src/index.ts`) allows injecting mock `db` and `roomElements` without starting an HTTP server.
