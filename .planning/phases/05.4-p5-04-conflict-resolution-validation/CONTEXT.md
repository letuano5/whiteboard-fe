# Context: Phase 5.4 P5-04 Conflict resolution & validation

## Source

- Canonical scope: `docs/SPECS.md` `[P5-04]`.
- Acceptance registry: `specs/033-p5-04-conflict-resolution-validation/acceptance.md`.
- Depends on: P5-02 shared sync contracts and P5-03 backend `SyncRoom`/room actor.

## Locked Decisions

- Conflict policy is backend-authoritative:
  - different slots merge,
  - same slot uses latest command committed on the server,
  - delete wins over later patches to deleted elements.
- `baseClock == currentSlotClock` commits cleanly.
- `baseClock < currentSlotClock` is accepted for stale same-slot writes under latest-to-server
  semantics; later P5-05 ack/rebase surfaces can report this as rebase.
- `baseClock > currentSlotClock` rejects with `STALE_CLIENT_STATE`.
- Viewer actors must be rejected before mutation planning, using backend actor context rather than
  any actor identity in the command payload.
- Validation is atomic: a hard validation error rejects the whole command and does not partially
  commit document state.
- P5-04 is backend-only; frontend reconciliation, socket ACK payload UX, transactional persistence,
  and durable idempotency are later P5 slices.

## Non-goals

- No P5-05 broadcast/ack/rebase protocol beyond result metadata needed by backend tests.
- No P5-06 database transaction or persisted processed-request table.
- No asset binary upload/storage/ref-count/GC. Asset validation only checks existing reference
  authorization through an injectable backend validator.
- No realtime frontend reconciliation changes.
