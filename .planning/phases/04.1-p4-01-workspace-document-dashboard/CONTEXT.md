# Phase 4.1: P4-01 Workspace + document dashboard - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning
**Source:** PRD Express Path (`specs/026-workspace-document-dashboard/acceptance.md`)

<domain>
## Phase Boundary

This phase turns saved rooms into dashboard-visible documents for authenticated users. It
must not replace the existing canvas route: saved documents continue to open via
`/?room=<uuid>`, while the dashboard uses `/dashboard` through native browser path checks.

</domain>

<decisions>
## Implementation Decisions

### Routing

- Anonymous root path without `room` remains the local-only board from P4-00.
- `/dashboard` is the document dashboard route; no router library is introduced.
- Opening a dashboard document records recent activity before navigating to `/?room=<uuid>`.

### Access Model

- `Room.ownerId` identifies owned documents.
- Existing `RoomMember` rows identify documents shared with the user. Non-owner membership
  is enough for `Shared with me`; invitation management is deferred to P4-02.
- Rename, archive, and delete are management actions and require `owner` or `admin`.

### Persistence

- Room metadata for P4-01 includes `workspaceId`, `visibility`, `locked`, `archivedAt`,
  `lastOpenedAt`, and `createdBy`.
- A full Workspace model is not required in this slice; personal/default workspace behavior
  can be represented by nullable `workspaceId`.
- Recent is tracked per user through `RoomMember.lastOpenedAt`, with `Room.lastOpenedAt`
  updated as a coarse room-level timestamp.

### Non-goals

- Public/private link admission, invitations, transfer owner, editor slot control, import,
  export, asset storage, and version history remain deferred to later P4 feature IDs.

</decisions>

<canonical_refs>

## Canonical References

### Product Scope

- `docs/SPECS.md` - canonical `[P4-01] Workspace + document dashboard` requirements.
- `specs/026-workspace-document-dashboard/acceptance.md` - append-only AC registry.

### Existing Decisions

- `AGENTS.md` - native query-string room routing and no router library.
- `.planning/phases/04.0-p4-00-anonymous-local-board-login-to-save/CONTEXT.md` - local board
  versus saved document distinction.

</canonical_refs>

<deferred>
## Deferred Ideas

- Sharing invitation UI and public/private access enforcement: P4-02.
- Admission control/locks beyond metadata display: P4-03.
- Native file import/export and version history: P4-04 through P4-07.

</deferred>

---

_Phase: 04.1-p4-01-workspace-document-dashboard_
_Context gathered: 2026-06-30 via PRD Express Path_
