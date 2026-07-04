# Phase 4.2: P4-02 Sharing, public/private access, invited users - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning
**Source:** PRD Express Path (`specs/027-sharing-access-invites/acceptance.md`)

<domain>
## Phase Boundary

This phase adds sharing controls for saved documents. It does not change the local-only board
path from P4-00 and does not introduce a router library: saved documents continue to use
`/?room=<uuid>`.

</domain>

<decisions>
## Implementation Decisions

### Access Model

- `Room.visibility` supports `private`, `link_view`, `link_edit`, and `public_view`.
- Explicit `RoomMember.role` is the base role when present and takes precedence over link role.
- Pending email invitations can grant or create membership when an authenticated user with that
  email joins or is resolved by auth middleware.
- The server returns both `baseRole` and `effectiveRole`; mutation checks use `effectiveRole`.
- `locked` downgrades link editors to viewer. Editor slot capacity is treated as unlimited until
  P4-03 introduces admission-control limits, so capacity never blocks P4-02 link edit.

### Owner Management

- Only owners can invite, change roles, remove members, revoke pending invites, or change/revoke
  share links.
- Owner transfer remains out of scope. Owners cannot remove themselves or lower their own role.
- Access management is exposed over authenticated HTTP routes and existing socket role-update
  behavior is kept compatible through server-side owner checks.

### Frontend UX

- The existing copy-link button becomes owner-only share controls for saved documents.
- `Manage access` opens a modal with a dark backdrop and member/pending-invite rows.
- Viewers see the canvas but not edit toolbar controls; backend rejection remains authoritative.

### Non-goals

- Transfer owner, finite editor-slot capacity, lock/admission queue UI, public discovery pages,
  file import/export, asset storage, and snapshot history remain deferred to later P4 feature IDs.

</decisions>

<canonical_refs>

## Canonical References

- `docs/SPECS.md` - canonical `[P4-02] Sharing, public/private access, invited users`.
- `specs/027-sharing-access-invites/acceptance.md` - append-only AC registry.
- `.planning/phases/04.1-p4-01-workspace-document-dashboard/CONTEXT.md` - dashboard and saved
  document decisions.

</canonical_refs>

<deferred>
## Deferred Ideas

- Admission queue, finite editor caps, and lock controls: P4-03.
- Native file lifecycle and import/export: P4-04/P4-05.
- Asset storage and version history: P4-06/P4-07.

</deferred>

---

_Phase: 04.2-p4-02-sharing-public-private-access-invited-users_
_Context gathered: 2026-06-30 via PRD Express Path_
