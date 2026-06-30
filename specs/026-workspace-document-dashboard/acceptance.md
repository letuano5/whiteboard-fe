# Acceptance Criteria

AC-1: Anonymous users do not see a personal dashboard; the dashboard route shows a login/local-board path instead of document lists.
AC-2: Authenticated dashboard queries are scoped to rooms the user owns or has a `RoomMember` record for, including search and filter requests.
AC-3: Dashboard separates accessible documents into `Owned`, `Shared with me`, and `Recent` groups; a room where the user is a non-owner member appears in `Shared with me`.
AC-4: Archived documents are hidden by default and appear only when the archived/retained filter is enabled.
AC-5: Creating a document from the dashboard creates a private room owned by the authenticated user, adds owner membership, and opens `/?room=<uuid>`.
AC-6: Rename, archive, and delete actions are rejected by the backend unless the actor is the room owner or has an admin role.
AC-7: Opening a document from the dashboard records `lastOpenedAt` for the current user's room membership so it can appear in `Recent`.
