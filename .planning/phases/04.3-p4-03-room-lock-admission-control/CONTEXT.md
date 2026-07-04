# Phase 4.3: P4-03 Room capacity control - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning
**Source:** PRD Express Path (`specs/028-room-lock-admission-control/acceptance.md`)

<domain>
## Phase Boundary

This phase builds on P4-02 saved-document sharing. It adds server-side capacity decisions for
participant/editor limits. It does not introduce room lock access semantics, native file
import/export, asset storage, version history, or a router library.

</domain>

<decisions>
## Implementation Decisions

### Capacity Semantics

- `maxParticipants` is a saved-room metadata field; when capacity is reached, a new participant is
  refused with a clear admission error.
- `maxEditors` is a saved-room metadata field; when editor capacity is full, an otherwise eligible
  editor joins as `effectiveRole = 'viewer'`.
- Capacity inputs are bounded: `maxParticipants <= 50`, `maxEditors <= 10`, and
  `maxEditors <= maxParticipants` when both are set.
- Existing explicit membership or link-derived role still determines `baseRole`; capacity may lower
  `effectiveRole`.
- P4-03 has no queue or realtime auto-promotion. Rejoin/reload may claim a newly available editor
  slot.

### Presence Contract

- Presence/session metadata must expose both `baseRole` and `effectiveRole`.
- Frontend UI uses the effective role to hide edit controls and explain why editing is unavailable.
- Backend enforcement remains authoritative for socket/HTTP mutations.

### Non-goals

- Room-level access lock/unlock, transfer owner, pending invite workflows beyond P4-02, queue
  management UI, realtime auto-promotion, import/export, asset storage, and snapshot history remain
  out of scope.

</decisions>

<canonical_refs>

## Canonical References

- `docs/SPECS.md` - canonical `[P4-03] Room capacity control`.
- `specs/028-room-lock-admission-control/acceptance.md` - append-only AC registry.
- `.planning/phases/04.2-p4-02-sharing-public-private-access-invited-users/CONTEXT.md` - sharing
  and effective-role decisions.

</canonical_refs>

<deferred>
## Deferred Ideas

- Realtime auto-promotion for users waiting on editor capacity.
- Dedicated capacity queue UI.
- File import/export, asset storage, and version history: P4-04 through P4-07.

</deferred>

---

_Phase: 04.3-p4-03-room-lock-admission-control_
_Context gathered: 2026-06-30 via PRD Express Path_
