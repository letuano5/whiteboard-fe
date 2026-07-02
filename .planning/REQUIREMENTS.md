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

### P5 Load Reconnect And Diff

- [ ] **P5-07-AC-1**: `ROOM_SNAPSHOT` hydrates full server state with protocol/schema versions,
      room/server clocks, epoch, elements, slot clocks, and optional processed-request history start.
- [ ] **P5-07-AC-2**: `ROOM_DIFF` returns changed records, deleted tombstones, newer slot clocks,
      server clock/epoch, and pagination metadata for a valid base clock.
- [ ] **P5-07-AC-3**: Reconnect requests include last applied server clock, room epoch, and pending
      request IDs, and responses include snapshot/diff kind plus pending request statuses.
- [ ] **P5-07-AC-4**: Pending statuses distinguish processed, unknown, conflict, and expired so
      clients do not resend conflict/expired requests blindly.
- [ ] **P5-07-AC-5**: Diff reads use a consistent target clock and return wipe-all snapshot for
      stale history or replace-boundary gaps.
- [ ] **P5-07-AC-6**: Diff slot clocks are coarse-filtered by record clock and then filtered per
      slot clock greater than the requested base clock.
- [ ] **P5-07-AC-7**: Clients update `lastServerClock` only after fully applying server payloads and
      keep per-element per-slot known clocks.
- [ ] **P5-07-AC-8**: Clients apply `ROOM_DIFF` slot-aware from `changed` plus `slotClocks` without
      requiring `originRequestIds`.

### P5 Delete Tombstone And Binding Repair

- [ ] **P5-08-AC-1**: DeleteElementsCommand for a bound target removes the deleted record, records a tombstone, and clears every arrow binding that references the deleted element so no active arrow points at a dead id.
- [ ] **P5-08-AC-2**: Delete repair emits full slot patches for repaired arrows, including binding and geometry slots, so peers applying the same CommittedChangeSet reach the same arrow state as the sender.
- [ ] **P5-08-AC-3**: Create/import/replace paths must not resurrect an element id that is inside tombstone retention unless the replace/import path explicitly owns that behavior in a later phase.
- [ ] **P5-08-AC-4**: Commands that exceed delete, repaired-arrow, or change-set limits reject with TOO_LARGE and leave document state unchanged.
- [ ] **P5-08-AC-5**: Moving, resizing, or rotating a bound target recomputes affected arrow endpoint geometry in the same server clock as the target mutation.
- [ ] **P5-08-AC-6**: Concurrent updates to startBinding and endBinding on the same arrow preserve both terminals and recompute geometry from server-current arrow and target state.
- [ ] **P5-08-AC-7**: Binding to a missing or deleted target rejects with INVALID_BINDING_TARGET before commit.
- [ ] **P5-08-AC-8**: A new delete request for an already tombstoned element rejects with ELEMENT_DELETED, while retrying the original delete request with the same actor/request id replays the original ACK.
- [x] **P5-11-AC-1**: Continuous drag sends durable sync patches no more often than the 100ms flush window, does not create an unbounded queue, and always sends the final pointerup patch.
- [x] **P5-11-AC-2**: Squashing unsent slot patches keeps the latest changes but preserves inverseChanges from the first before-state in the window; backpressure never drops create/delete/replace/binding commands and pauses for resync when overload cannot be squashed.
- [x] **P5-11-AC-3**: When client A drags a shape while client B changes a different slot such as fill color, reconciliation preserves B's committed color and A's final accepted drag.
- [x] **P5-11-AC-4**: Late ACKs with an old serverClock clear only their matching pending request and never overwrite newer optimistic state.
- [x] **P5-11-AC-5**: Reload/reconnect pending status handling does not double-apply commands already processed by the server.
- [x] **P5-11-AC-6**: Initial undo support only emits an inverse single-slot patch when the slot clock still equals the original edit's afterSlotClock; if the slot changed, undo reports a conflict/manual retry instead of auto-applying.
- [x] **P5-11-AC-7**: Pending create followed by patch/delete preserves dependency order after reconnect and never sends a patch/delete for an element before its create.
- [x] **P5-11-AC-8**: Presence, cursor, selection, and draft preview remain ephemeral and are not sent as SlotPatch/SyncCommand persistence mutations.

## Out of Scope

| Feature                                  | Reason                  |
| ---------------------------------------- | ----------------------- |
| Admission queues and room lock UI polish | Deferred to P4-03       |
| Import/export file lifecycle             | Deferred to P4-04/P4-05 |
| Asset storage and version history        | Deferred to P4-06/P4-07 |

## Traceability

| Requirement | Phase      | Status   |
| ----------- | ---------- | -------- |
| P4-00-AC-1  | Phase 4.0  | Complete |
| P4-00-AC-2  | Phase 4.0  | Complete |
| P4-00-AC-3  | Phase 4.0  | Complete |
| P4-00-AC-4  | Phase 4.0  | Complete |
| P4-00-AC-5  | Phase 4.0  | Complete |
| P4-00-AC-6  | Phase 4.0  | Complete |
| P4-00-AC-7  | Phase 4.0  | Complete |
| P4-00-AC-8  | Phase 4.0  | Complete |
| P4-00-AC-9  | Phase 4.0  | Complete |
| P4-01-AC-1  | Phase 4.1  | Complete |
| P4-01-AC-2  | Phase 4.1  | Complete |
| P4-01-AC-3  | Phase 4.1  | Complete |
| P4-01-AC-4  | Phase 4.1  | Complete |
| P4-01-AC-5  | Phase 4.1  | Complete |
| P4-01-AC-6  | Phase 4.1  | Complete |
| P4-01-AC-7  | Phase 4.1  | Complete |
| P4-02-AC-1  | Phase 4.2  | Complete |
| P4-02-AC-2  | Phase 4.2  | Complete |
| P4-02-AC-3  | Phase 4.2  | Complete |
| P4-02-AC-4  | Phase 4.2  | Complete |
| P4-02-AC-5  | Phase 4.2  | Complete |
| P4-02-AC-6  | Phase 4.2  | Complete |
| P4-02-AC-7  | Phase 4.2  | Complete |
| P4-02-AC-8  | Phase 4.2  | Complete |
| P4-02-AC-9  | Phase 4.2  | Complete |
| P4-04-AC-1  | Phase 4.4  | Complete |
| P4-04-AC-2  | Phase 4.4  | Complete |
| P4-04-AC-3  | Phase 4.4  | Complete |
| P4-04-AC-4  | Phase 4.4  | Complete |
| P4-04-AC-5  | Phase 4.4  | Complete |
| P5-07-AC-1  | Phase 5.7  | Complete |
| P5-07-AC-2  | Phase 5.7  | Complete |
| P5-07-AC-3  | Phase 5.7  | Complete |
| P5-07-AC-4  | Phase 5.7  | Complete |
| P5-07-AC-5  | Phase 5.7  | Complete |
| P5-07-AC-6  | Phase 5.7  | Complete |
| P5-07-AC-7  | Phase 5.7  | Complete |
| P5-07-AC-8  | Phase 5.7  | Complete |
| P5-08-AC-1  | Phase 5.8  | Complete |
| P5-08-AC-2  | Phase 5.8  | Complete |
| P5-08-AC-3  | Phase 5.8  | Complete |
| P5-08-AC-4  | Phase 5.8  | Complete |
| P5-08-AC-5  | Phase 5.8  | Complete |
| P5-08-AC-6  | Phase 5.8  | Complete |
| P5-08-AC-7  | Phase 5.8  | Complete |
| P5-08-AC-8  | Phase 5.8  | Complete |
| P5-11-AC-1  | Phase 5.11 | Complete |
| P5-11-AC-2  | Phase 5.11 | Complete |
| P5-11-AC-3  | Phase 5.11 | Complete |
| P5-11-AC-4  | Phase 5.11 | Complete |
| P5-11-AC-5  | Phase 5.11 | Complete |
| P5-11-AC-6  | Phase 5.11 | Complete |
| P5-11-AC-7  | Phase 5.11 | Complete |
| P5-11-AC-8  | Phase 5.11 | Complete |

**Coverage:**

- v1 requirements: 54 total
- Mapped to phases: 54
- Unmapped: 0

---

_Requirements defined: 2026-06-30_
_Last updated: 2026-07-02 after P5-11 verification_
