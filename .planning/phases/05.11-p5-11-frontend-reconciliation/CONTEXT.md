# Phase 5.11 Context: P5-11 Frontend reconciliation

## Source

- Canonical scope: `docs/SPECS.md` `[P5-11] Frontend reconciliation`.
- GSD mapping: repo roadmap ID `P5-11` maps to GSD Phase `5.11`.
- Acceptance registry: `specs/040-p5-11-frontend-reconciliation/acceptance.md`.

## Locked Decisions

- Saved-room local mutations should be emitted as shared P5 `SyncCommand` payloads over
  `WS_EVENTS.SYNC_COMMAND`, not as legacy `ELEMENT_UPDATE` writes.
- The frontend keeps server-applied clock state separately from pending optimistic commands: the
  existing element store remains the materialized view shown to the user, while socket sync state
  owns known slot clocks, pending commands, buffered change sets, and replay metadata.
- Continuous drag uses durable `patch-slots` flushes at `DURABLE_DRAG_FLUSH_MS = 100`; transient
  draft/presence preview remains `ELEMENT_DRAFT`/presence only and does not increase documentClock.
- Backpressure defaults are fixed by SPECS: in-flight commands max 2, queued commands max 64, and
  unsent patches coalesce to one per `{ elementId, slot }`.
- Create/delete/replace/binding commands are never dropped by squash. If overload remains after
  squash, the client pauses sending and asks for diff/resync.
- Undo in this phase is command metadata only: inverse single-slot patch is safe only when the slot
  clock still matches the edit's recorded afterSlotClock.

## Non-goals

- Full multiplayer-aware undo for create/delete/binding/replace.
- Character-level text merge, per-point freehand merge, CRDT, or new backend sync semantics.
- Removing local-board/cross-tab uses of legacy `applyRemoteElements`.

## Target Modules

- `frontend/src/sync/socket/p5-command-queue.ts` for command creation, coalescing, backpressure,
  dependency ordering, and undo metadata.
- `frontend/src/sync/socket/subscriptions.ts` to route saved-room mutation hooks through
  `WS_EVENTS.SYNC_COMMAND`.
- `frontend/src/sync/socket/event-handlers.ts` and `frontend/src/sync/socket/p5-reconciliation.ts`
  for ACK/diff/reconnect integration with the pending command queue.
- `frontend/src/sync/socket/state.ts` for pending command state and server/optimistic bookkeeping.
- Focused Vitest coverage under `frontend/src/sync/socket/`.

## Verification Map

- AC-1, AC-2, AC-6, AC-7, AC-8: command queue unit tests.
- AC-3, AC-4, AC-5: reconciliation tests.
- Coverage guard:
  `.agents/skills/implement-feature-gsd/scripts/check-ac-coverage.sh specs/040-p5-11-frontend-reconciliation/acceptance.md frontend/src/sync/socket/p5-command-queue.test.ts frontend/src/sync/socket/p5-reconciliation.test.ts`
