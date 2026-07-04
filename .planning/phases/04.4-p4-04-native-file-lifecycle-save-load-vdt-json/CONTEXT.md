# Phase 4.4: P4-04 Native file lifecycle: save/load `.vdt.json` - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning
**Source:** PRD Express Path (`specs/029-native-file-lifecycle/acceptance.md`)

<domain>
## Phase Boundary

This phase implements the native VDT backup format only. Export/import must work for the root
local board and for saved documents opened through `/?room=<uuid>`. Cross-platform Excalidraw,
draw.io, PNG, SVG, asset storage, and version history are explicitly out of scope.

</domain>

<decisions>
## Implementation Decisions

### Native File Contract

- The native file extension is `.vdt.json`.
- The file contains a schema version, minimal room metadata, camera, elements, and optional asset
  metadata.
- The schema validator must reject malformed files, missing required fields, unsupported schema
  versions, and invalid element/camera payloads with clear errors.
- Existing element objects should round-trip without dropping current fields such as `type`,
  `props`, `zIndex`, `angle`, `groupId`, `frameId`, `locked`, and version metadata.

### Import Behavior

- Export is allowed for both local and saved boards.
- Import into a non-empty board requires explicit confirmation before replace or merge. P4-04 may
  implement replace-first UX as long as the user confirms before any destructive state change.
- Anonymous import updates only local store/local persistence. It must not create a DB room or
  navigate to `/?room=<uuid>`.
- Saved-room import calls a backend endpoint that checks authenticated effective role and writes via
  `saveRoomElements`; viewers are rejected.
- Creating a new saved document from import is allowed only through the existing authenticated
  local-to-saved path or a dedicated authenticated creation path if implemented in this phase.

### Non-goals

- No Excalidraw/draw.io import, PNG/SVG export, S3/pre-S3 asset storage adapter, snapshot before
  import, version history restore, router library, or realtime queue/autopromotion changes.

</decisions>

<canonical_refs>

## Canonical References

- `docs/SPECS.md` - canonical `[P4-04] Native file lifecycle`.
- `specs/029-native-file-lifecycle/acceptance.md` - append-only AC registry.
- `.planning/phases/04.3-p4-03-room-lock-admission-control/CONTEXT.md` - effective-role and
  capacity decisions from the prior phase.

</canonical_refs>

<deferred>
## Deferred Ideas

- Export PNG/SVG and third-party importers: P4-05.
- Asset metadata storage adapter: P4-06.
- Snapshot safety net before import/restore: P4-07.

</deferred>

---

_Phase: 04.4-p4-04-native-file-lifecycle-save-load-vdt-json_
_Context gathered: 2026-07-01 via PRD Express Path_
