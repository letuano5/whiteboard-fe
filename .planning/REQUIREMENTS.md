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

## Out of Scope

| Feature                                 | Reason                                                 |
| --------------------------------------- | ------------------------------------------------------ |
| Anonymous network rooms                 | Deferred to P4-02 link/public modes in `docs/SPECS.md` |
| Workspace dashboard                     | Deferred to P4-01                                      |
| Public/private invited-user enforcement | Deferred to P4-02                                      |
| Import/export file lifecycle            | Deferred to P4-04/P4-05                                |

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

**Coverage:**

- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---

_Requirements defined: 2026-06-30_
_Last updated: 2026-06-30 after P4-01 verification_
