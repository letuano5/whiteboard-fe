# Phase 4.7: P4-07 Version history (snapshot) + owner restore - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning
**Source:** PRD Express Path (`specs/045-p4-07-version-history/acceptance.md`) plus `docs/SPECS.md` `[P4-07]`

<domain>
## Phase Boundary

P4-07 adds version history for saved documents only. The system stores server-side snapshots of
materialized document truth, lists snapshot metadata in the saved-room UI, and lets the room owner
restore a snapshot through the existing authoritative replace path.

Local-only boards do not create server snapshots. Manual "save version" creation is deferred for
now even though `docs/SPECS.md` mentions a manual trigger/API: this implementation focuses on
automatic interval snapshots, restore safety snapshots, import safety snapshots, and owner restore.
</domain>

<decisions>
## Implementation Decisions

### Product Behavior

- Snapshot history applies only to saved documents opened through `/?room=<uuid>`.
- The UI shows a compact history panel with snapshot timestamp, reason, createdBy, documentClock,
  roomEpoch, and a Restore action for owners.
- Restore requires an explicit confirmation because it replaces the whole document.
- Owners can restore snapshots. Editors and viewers cannot restore snapshots.
- Manual snapshot creation UI/API is out of scope for this phase; automatic and safety snapshots
  are the accepted source of version history.

### Backend Contract

- Add Prisma `Snapshot` related to `Room` with `documentClock`, `roomEpoch`, `createdBy`,
  `createdAt`, `reason`, `records`, and `tombstones`.
- HTTP endpoints for this phase:
  - `GET /api/rooms/:roomId/snapshots`
  - `POST /api/rooms/:roomId/snapshots/:snapshotId/restore`
- No `ROOM_RESTORED` event is introduced. Restore broadcasts existing `ROOM_REPLACED`.
- Restore must call `executeReplaceDocument` with reason `restore` and must not directly mutate
  `Record` or `Tombstone`.
- Import must create an `import_safety` snapshot before executing the saved-room replace.
- Restore must create a `restore_safety` snapshot before executing the saved-room replace.

### Automatic Snapshot Trigger

- After durable committed saved-room changes, the backend attempts an interval snapshot when at
  least `30_000ms` elapsed since the latest snapshot and the current document clock is greater
  than the latest snapshot clock.
- Snapshot content is read from materialized server truth: hot `SyncRoom` state when available,
  otherwise the persisted room records/tombstones.
- Retention compaction from `docs/SPECS.md` is not required for this MVP implementation unless
  it can be added safely without changing the public contract.

### Frontend Reconciliation

- Existing `ROOM_REPLACED` handling already clears pending queue state, pending sync commands,
  in-flight requests, buffered events, hydrates slot clocks/epoch/clock, and clears undo/redo
  history. P4-07 tests must lock this as acceptance behavior.
  </decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Scope

- `docs/SPECS.md` — canonical P4-07 behavior and acceptance criteria.
- `specs/045-p4-07-version-history/acceptance.md` — append-only acceptance registry for this implementation.

### Existing Architecture

- `backend/src/sync/execute-sync-command.ts` — existing `executeReplaceDocument` and `ROOM_REPLACED` payload construction.
- `backend/src/sync/sync-room-persistence.ts` — authoritative Record/Tombstone persistence path.
- `backend/src/rooms/native-file-import.ts` — saved-room import path that needs import safety snapshots.
- `frontend/src/sync/socket/p5-reconciliation.ts` — existing `ROOM_REPLACED` reconciliation and undo/redo clearing.
  </canonical_refs>

<specifics>
## Specific Ideas

- Keep backend snapshot logic in a dedicated room-history module rather than adding it to route
  handlers or SyncRoom internals wholesale.
- Wire an optional snapshot service into SyncRoom persistence so interval capture runs after
  successful commits without depending on client state.
- Use lucide `History`, `RotateCcw`, `X`, and `Loader2` icons for the compact panel controls.
  </specifics>

<deferred>
## Deferred Ideas

- Manual snapshot button/API.
- Full retention tier compaction.
- Restoring old tombstone replay history into DB.
- Admin restore separate from room owner.
  </deferred>

---

_Phase: 04.7-p4-07-version-history-snapshot-owner-restore_
_Context gathered: 2026-07-03 via PRD Express Path_
