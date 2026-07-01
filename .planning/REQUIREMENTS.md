# Requirements: Realtime Collaborative Tactical Whiteboard

**Defined:** 2026-06-30
**Core Value:** Users can create tactical whiteboards without losing work, then collaborate or persist documents when the workflow calls for it.

## v1 Requirements

### Local Board And Save

- [ ] **P4-00-AC-1**: Anonymous users can create and use a local-only board immediately.
- [ ] **P4-00-AC-2**: Local-only board state does not create `Room`, `Record`, `Tombstone`, or
      `RoomMember` rows.
- [ ] **P4-00-AC-3**: Local-only board persists in browser storage and syncs across browser tabs.
- [ ] **P4-00-AC-4**: Local-only board does not connect to backend persistence/autosave or
      anonymous network realtime.
- [ ] **P4-00-AC-5**: Local-only board shows a single `Login to save` CTA, while saved documents
      do not show that CTA.
- [ ] **P4-00-AC-6**: After login, the user can confirm conversion of the current local board into
      a saved document.
- [ ] **P4-00-AC-7**: Confirmed conversion creates a persisted room with the current user as owner.
- [ ] **P4-00-AC-8**: Conversion preserves visible canvas content and metadata needed for sync.
- [ ] **P4-00-AC-9**: Failed login or failed save leaves local board data intact and shows an error.

### Workspace Dashboard

- [ ] **P4-01-AC-1**: Anonymous users do not see personal document lists and are routed to login/local-board actions.
- [ ] **P4-01-AC-2**: Authenticated dashboard queries return only rooms the user owns or has membership for.
- [ ] **P4-01-AC-3**: Accessible documents are grouped as Owned, Shared with me, and Recent.
- [ ] **P4-01-AC-4**: Archived documents are hidden by default and visible only with the archived filter.
- [ ] **P4-01-AC-5**: Creating a dashboard document creates a private owner room and opens it as `/?room=<uuid>`.
- [ ] **P4-01-AC-6**: Rename, archive, and delete require owner/admin permission.
- [ ] **P4-01-AC-7**: Opening a dashboard document records `lastOpenedAt` for Recent.

### Sharing And Invites

- [ ] **P4-02-AC-1**: Owners can manage access from a modal with invite, role-change, remove, and pending-invite revoke actions.
- [ ] **P4-02-AC-2**: Non-owners cannot manage access through either visible UI or backend access-management calls.
- [ ] **P4-02-AC-3**: Existing invited users join with the role assigned to their email invite.
- [ ] **P4-02-AC-4**: Pending invites are claimed when a user logs in or registers with the invited email.
- [ ] **P4-02-AC-5**: Viewers cannot edit in the UI and server-side element mutation rejects them.
- [ ] **P4-02-AC-6**: Private rooms reject users without owner, membership, or claimable invite access.
- [ ] **P4-02-AC-7**: `link_view` grants link visitors viewer effective access.
- [ ] **P4-02-AC-8**: `link_edit` grants editor effective access only when lock/capacity rules allow it.
- [ ] **P4-02-AC-9**: Revoked links no longer grant link-based room access.

### Native File Lifecycle

- [ ] **P4-04-AC-1**: Export then import of `.vdt.json` preserves existing element types,
      styling, zIndex, angle, group/frame metadata, camera, and room metadata.
- [ ] **P4-04-AC-2**: Anonymous import applies to the local board only and does not create a
      persisted database room unless the user later chooses login/save.
- [ ] **P4-04-AC-3**: Authenticated import into a saved document is rejected for viewers and
      permitted only for owner/editor effective roles.
- [ ] **P4-04-AC-4**: Invalid or unsupported native schemas do not crash the app and show a clear
      validation error.
- [ ] **P4-04-AC-5**: Loading a native file into a board/document that already has data requires
      explicit confirmation before replacing or merging.

## Out of Scope

| Feature                                  | Reason                  |
| ---------------------------------------- | ----------------------- |
| Admission queues and room lock UI polish | Deferred to P4-03       |
| Import/export file lifecycle             | Deferred to P4-04/P4-05 |
| Asset storage and version history        | Deferred to P4-06/P4-07 |

## Traceability

| Requirement | Phase     | Status   |
| ----------- | --------- | -------- |
| P4-00-AC-1  | Phase 4.0 | Complete |
| P4-00-AC-2  | Phase 4.0 | Complete |
| P4-00-AC-3  | Phase 4.0 | Complete |
| P4-00-AC-4  | Phase 4.0 | Complete |
| P4-00-AC-5  | Phase 4.0 | Complete |
| P4-00-AC-6  | Phase 4.0 | Complete |
| P4-00-AC-7  | Phase 4.0 | Complete |
| P4-00-AC-8  | Phase 4.0 | Complete |
| P4-00-AC-9  | Phase 4.0 | Complete |
| P4-01-AC-1  | Phase 4.1 | Complete |
| P4-01-AC-2  | Phase 4.1 | Complete |
| P4-01-AC-3  | Phase 4.1 | Complete |
| P4-01-AC-4  | Phase 4.1 | Complete |
| P4-01-AC-5  | Phase 4.1 | Complete |
| P4-01-AC-6  | Phase 4.1 | Complete |
| P4-01-AC-7  | Phase 4.1 | Complete |
| P4-02-AC-1  | Phase 4.2 | Complete |
| P4-02-AC-2  | Phase 4.2 | Complete |
| P4-02-AC-3  | Phase 4.2 | Complete |
| P4-02-AC-4  | Phase 4.2 | Complete |
| P4-02-AC-5  | Phase 4.2 | Complete |
| P4-02-AC-6  | Phase 4.2 | Complete |
| P4-02-AC-7  | Phase 4.2 | Complete |
| P4-02-AC-8  | Phase 4.2 | Complete |
| P4-02-AC-9  | Phase 4.2 | Complete |
| P4-04-AC-1  | Phase 4.4 | Complete |
| P4-04-AC-2  | Phase 4.4 | Complete |
| P4-04-AC-3  | Phase 4.4 | Complete |
| P4-04-AC-4  | Phase 4.4 | Complete |
| P4-04-AC-5  | Phase 4.4 | Complete |

**Coverage:**

- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---

_Requirements defined: 2026-06-30_
_Last updated: 2026-07-01 after P4-04 verification_
