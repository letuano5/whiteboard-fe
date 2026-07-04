# Context: Phase 5.6 P5-06 Transactional persistence & idempotency

## Source

- Canonical scope: `docs/SPECS.md` `[P5-06]`.
- Acceptance registry: `specs/035-p5-06-transactional-persistence-idempotency/acceptance.md`.
- Depends on: P5-03 `SyncRoom`, P5-04 validation/conflict planning, and P5-05 committed
  change-set/ACK/broadcast primitives.

## Locked Decisions

- `SyncRoom` remains the server-authoritative write path for saved-room P5 commands.
- The room actor serializes the single-process critical section; the DB path uses a conditional
  `Room.documentClock` update as the multi-instance split-brain backstop.
- Durable idempotency is based on `{ roomId, actorId, requestId }` and a canonical payload hash
  of the normalized command payload, excluding caller-supplied actor/debug/transient metadata.
- Idempotency lookup happens before domain validation so a committed create retry can replay its
  result instead of failing later as a duplicate element.
- Memory is not mutated until persistence commit succeeds.
- Duplicate replays return the original result and do not run `afterApply`, preventing duplicate
  peer broadcasts.
- Commands default to durable/resendable. Only explicitly non-resendable intermediate transient
  patch commands may use relaxed durability and skip `ProcessedRequest`.
- Shared command envelopes carry optional delivery/persistence hints for transient patch commands;
  absence of hints means durable, resendable, and `ProcessedRequest` persisted.
- `synchronous_commit = off` is documented and modeled as relaxed/best-effort, not durable.
- Socket handlers emit reject ACKs for expected domain errors, but persistence failures and
  unhealthy-room recovery paths do not ACK the command because no committed server response can be
  trusted for that request.
- Persistence writes must keep touched `recordClock`, `deletedClock`, and touched slot clocks equal
  to the command's single `documentClock`; full record slot-clock JSON must preserve older clocks,
  with `recordClock = max(slotClocks[*].clock)`.
- Reload recovery rebuilds the hot room's in-memory indexes/maps before accepting commands again:
  active elements, per-slot clocks, tombstone IDs, and processed request cache.

## Non-goals

- No frontend P5 command migration; that remains P5-11.
- No Redis/shared actor ownership or sticky routing lease; conditional clock update is the P5-06
  backstop.
- No retention GC implementation beyond schema/API support for
  `processedRequestHistoryStartsAtClock`; active GC policy can be a later hardening task.
