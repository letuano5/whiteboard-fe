# Phase 5.1 Context: P5-01 Module Boundary & Legacy Removal

## Source

- Canonical roadmap block: `docs/SPECS.md` `[P5-01]`
- Acceptance registry: `specs/030-p5-01-module-boundary-legacy-removal/acceptance.md`
- GSD mapping: repo roadmap ID `P5-01` maps to GSD Phase `5.1`.

## Locked Decisions

- P5-01 is backend-only.
- The backend sync module lives under `backend/src/sync/`.
- The unified entrypoint is `executeSyncCommand(command, actorContext)`.
- P5-02 owns final shared `SyncCommand`/`SlotPatch` contracts. P5-01 may define backend-internal compatibility commands so legacy saved-room surfaces can route through the new boundary now.
- Existing Socket.IO `ELEMENT_UPDATE` may remain as a compatibility adapter in this phase, but saved-room mutation logic must not live in the socket handler.
- Native saved-room import must call the sync entrypoint rather than calling the room repository directly.
- The current native import behavior is preserved; P5-01 does not reinterpret merge/replace semantics. Its backend command is named `native-file-import` to avoid implying final P5 `REPLACE_DOCUMENT` semantics before P5-09.
- Frontend `applyRemoteElements` and whole-element version fields remain outside this backend slice; if mentioned in code comments, they must be scoped as local/cross-tab or legacy compatibility behavior.

## Non-Goals

- Do not implement slot-level conflict resolution, idempotency, room actors, or shared P5 protocol contracts in this slice.
- Do not remove frontend legacy sync behavior.
- Do not change URL routing, room access semantics, native import semantics, or native file schema.

## Acceptance Mapping

- `AC-1`: covered by source inspection and sync module tests proving handlers delegate document mutation.
- `AC-2`: covered by backend tests for realtime element update and native-file import through `executeSyncCommand`.
- `AC-3`: covered by comments on legacy compatibility surfaces and source inspection.
