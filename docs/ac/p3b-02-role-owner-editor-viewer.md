# P3B-02 Role owner / editor / viewer - Acceptance Criteria

Status: Shipped

AC-1: Room access resolves to a database-backed role (`owner`, `editor`, or `viewer`) on room join, using `RoomMember.role` or room ownership instead of JWT claims.
AC-2: The server rejects committed element mutations from sessions whose resolved room role is `viewer`, while allowing `owner` and `editor`.
AC-3: The frontend receives the current room role and hides editing toolbar/actions for `viewer` sessions.
AC-4: Owners can see room members and change non-owner member roles between `editor` and `viewer`.
AC-5: Role changes persist to `RoomMember.role` and are broadcast/reflected to connected clients without storing room roles in JWTs.

Implementation checklist:
- [x] Task 1 - Add shared role/access contracts and backend role resolution helpers.
- [x] Task 2 - Resolve and emit room access on join; reject viewer element mutations on the server.
- [x] Task 3 - Add owner role-update socket handling backed by `RoomMember.role`.
- [x] Task 4 - Add frontend room-access state, viewer-only UI hiding, and owner member-role controls.
- [x] Task 5 - Add focused backend/frontend tests for role resolution, viewer rejection, and role-aware UI.
- [x] Task 6 - Run focused verification, update this AC file and append `STATE.md`.

Delta notes:
- None.
