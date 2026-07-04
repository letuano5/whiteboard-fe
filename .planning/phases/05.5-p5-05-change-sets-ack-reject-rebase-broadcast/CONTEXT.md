# Context: Phase 5.5 P5-05 Change sets, ack/reject/rebase & broadcast

## Source

- Canonical scope: `docs/SPECS.md` `[P5-05]`.
- Acceptance registry: `specs/034-p5-05-change-sets-ack-broadcast/acceptance.md`.
- Depends on: P5-02 shared sync contracts, P5-03 backend `SyncRoom`, and P5-04 conflict
  resolution/validation.

## Locked Decisions

- `CommittedChangeSet` is the authoritative P5 reconciliation payload.
- `slotPatches` are the primary apply instructions for patch/update/repair; `puts` carry
  materialized elements for create, replace, reconnect/debug/persistence, and compatibility.
- `SyncAck` status is one of `commit`, `rebase`, or `reject`.
- `commit` and `rebase` ACKs include a `changeSet`; `reject` includes a reason and may include a
  `serverChangeSet`.
- `SyncBroadcast` carries the same `CommittedChangeSet` for peers; sender may clear pending from
  a same-origin broadcast when ACK is missed.
- Client-side P5 reconciliation ignores stale ACK/broadcast clocks, buffers future clocks, and
  requests `ROOM_DIFF` on a server-clock gap.
- This slice does not replace legacy `ELEMENT_UPDATE` as the main frontend mutation transport; it
  introduces the P5 protocol/reconciliation primitives for the later frontend migration.

## Non-goals

- No P5-06 durable idempotency or DB transaction implementation.
- No full mutation-pipeline conversion from legacy element arrays to P5 commands.
- No complete socket handler swap away from the legacy saved-room compatibility event.
