# Context: Phase 5.9 P5-09 Replace document for import/restore

## Source

- Canonical scope: `docs/SPECS.md` `[P5-09]`.
- Acceptance registry: `specs/038-p5-09-replace-document-import-restore/acceptance.md`.
- GSD mapping: repo roadmap ID `P5-09` maps to GSD Phase `5.9`.
- Depends on: P5-06 transactional persistence, P5-07 room epoch reconnect semantics, and P5-08
  tombstone/binding repair behavior.

## Locked Decisions

- `ReplaceDocumentCommand` is the authoritative path for saved-document native import and future
  snapshot restore.
- Import adapters parse, validate, and check permissions before building a replace command; they do
  not write records/tombstones directly.
- Replace increments `roomEpoch` and stamps one `CommittedChangeSet` with reason
  `replace_document`.
- Current active ids absent from the replacement document become tombstones at the replace
  `serverClock`.
- Incoming active elements are normalized to `isDeleted: false` and receive freshly rebuilt slot
  clocks for all sync slots. Existing slot clocks for the same id/type are not retained.
- The initial implementation does not create safety snapshots because version-history snapshots are
  not yet enabled in the codebase; it leaves a single replace hook for future restore/snapshot calls.
- Realtime peers receive a dedicated `ROOM_REPLACED` payload for wipe-and-hydrate, while the normal
  committed change set/ACK still exists for protocol continuity.
- Client `ROOM_REPLACED` handling wipes pending requests and hydrates state from the payload. Old ACKs
  for cleared request IDs must not re-apply stale pre-replace state.

## Non-goals

- No snapshot/version-history storage implementation.
- No binary asset upload/storage changes.
- No complete P5-11 frontend command migration beyond `ROOM_REPLACED` reconciliation.
