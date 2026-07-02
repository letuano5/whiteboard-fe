# Phase 5.7 Context: P5-07 Load, reconnect & diff

## Source And Mapping

- Repo roadmap ID: `P5-07`
- GSD phase: `5.7`
- Canonical source: `docs/SPECS.md` section `[P5-07] Load, reconnect & diff`
- Acceptance registry: `specs/036-p5-07-load-reconnect-diff/acceptance.md`

## Locked Decisions

- P5-07 builds on P5-06. `Room.documentClock`, `Room.roomEpoch`, `Record.recordClock`,
  `Record.slotClocks`, `Tombstone.deletedClock`, and `ProcessedRequest` are the persisted source
  for reconnect/load behavior.
- `ROOM_SNAPSHOT` and `ROOM_DIFF` keep the existing Socket.IO event names but upgrade payloads to
  P5 protocol contracts. Legacy `documentClock` is represented as `serverClock`; compatibility may
  keep `documentClock` aliases only where old tests or handlers still need them.
- Diff is read at a stable `targetClock = Room.documentClock`. The repository query must coarse
  filter by `Record.recordClock` and `Tombstone.deletedClock`, then return only slot clocks whose
  stored clock is newer than the requested base clock.
- If `lastServerClock < roomEpoch`, reconnect must not return an incremental diff. It returns a
  wipe-all snapshot at the current server clock/epoch.
- Tombstone GC is not implemented in this slice. Retain tombstones indefinitely and expose
  `tombstoneHistoryStartsAtClock = 0` / history-safe behavior until a future GC phase changes it.
- Pending request status is derived from persisted `ProcessedRequest` where possible. Unknown
  pending request IDs are returned as `unknown`; expired/conflict are represented in the contract
  and covered in pure status-classification tests in this phase.
- Client `lastServerClock` means "the latest full server document clock applied into server state".
  It must not be inferred from the max of individual slot clocks.
- Client slot-aware diff apply copies only the slots listed in `slotClocks` with clocks newer than
  the previous known slot clock. New elements or wipe-all snapshots may materialize full elements.

## Non-Goals

- No frontend P5 command generation/backpressure migration; that belongs to P5-11.
- No tombstone GC job or chunked streaming implementation beyond contract fields and safe
  `hasMore: false` responses for current payload sizes.
- No replace-document implementation; P5-07 only handles the reconnect/load boundary behavior using
  `roomEpoch` already present in storage.

## Target Areas

- Shared contracts: `packages/shared/src/sync-contracts/types.ts`
- Backend repository and realtime handlers:
  - `backend/src/persistence/room-repository/types.ts`
  - `backend/src/persistence/room-repository/load-room.ts`
  - `backend/src/persistence/room-repository/room-diff.ts`
  - `backend/src/realtime/types.ts`
  - `backend/src/realtime/handlers/join-room.ts`
  - `backend/src/realtime/handlers/room-diff-request.ts`
- Frontend reconciliation:
  - `frontend/src/sync/socket/types.ts`
  - `frontend/src/sync/socket/event-handlers.ts`
  - `frontend/src/sync/socket/p5-change-set.ts`
  - `frontend/src/sync/socket/p5-reconciliation.ts`
  - `frontend/src/sync/socket/state.ts`

## Verification

- Acceptance tests must tag every criterion with `@covers AC-n`.
- Run AC coverage guard against `specs/036-p5-07-load-reconnect-diff/acceptance.md`.
- Run focused backend/frontend/shared tests first, then package-level `pnpm typecheck` and relevant
  test command.
