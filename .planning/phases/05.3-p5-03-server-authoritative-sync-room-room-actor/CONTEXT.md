# Context: Phase 5.3 P5-03 Server-authoritative SyncRoom + room actor

## Source

- Canonical scope: `docs/SPECS.md` `[P5-03]`.
- Acceptance registry: `specs/032-p5-03-server-authoritative-sync-room/acceptance.md`.
- Depends on: P5-01 sync module boundary and P5-02 shared sync contracts.

## Locked Decisions

- `SyncRoom` is backend-only for this slice and owns hot saved-room execution state:
  `elements`, `documentClock`, `roomEpoch`, `slotClocks`, and `processedRequests`.
- A room actor serializes only commands for the same room. Cross-room commands use independent
  promise queues so one room's slow commit does not globally block another room.
- The critical section is: idempotency check, command planning, repository commit, committed-state
  application, then result enqueueing.
- Server-side sequence order, not client timestamps or `clientClock`, determines commit order.
- P5-03 keeps actual slot conflict semantics minimal. P5-04 owns slot conflict rules and validation
  beyond the existing P5-02 shared validators.
- This phase may continue to support P5-01 legacy compatibility commands, but duplicate protection
  must be available for shared P5 commands that carry `requestId`.

## Non-goals

- No multi-process room ownership, Redis sequencing, or horizontal write scaling.
- No frontend reconciliation changes.
- No transactional database idempotency table. P5-06 owns persisted idempotency.
- No full conflict resolution matrix. P5-04 owns stale slot behavior, delete-wins, and validation
  limits.
