# Acceptance Criteria Registry — Live Cursor & Online Users

> Append-only. IDs are immutable once assigned — never renumber or repurpose.
> Source: spec.md User Story 1 + User Story 2 acceptance scenarios.

AC-1: Given two users are in the same room, when User A moves their cursor, then User B sees a labeled cursor indicator tracking User A's position in real time.
AC-2: Given User A's cursor is displayed on User B's screen, when User A moves to a different position, then the cursor indicator on User B's screen updates to the new position.
AC-3: Given two users are in the same room, when User A moves their cursor, then User A does NOT see their own cursor represented as a remote cursor overlay.
AC-4: Given two users are in different rooms, when User A moves their cursor, then User B (in the other room) does NOT receive the cursor event.
AC-5: Given User A's cursor is visible on User B's screen, when User A leaves the room, then User A's cursor indicator disappears from User B's screen.
AC-6: Given User A moves their cursor very rapidly, when cursor events are sent to the server, then the events are throttled to at most one per ~33 ms.
AC-7: Given User A pans or zooms the canvas, when cursor positions were transmitted in world coordinates, then remote cursor indicators remain at the correct world position regardless of local camera state.
AC-8: Given a user joins a room, when they load the whiteboard, then they see an online user panel listing every currently connected user with name and color badge.
AC-9: Given a second user joins the same room, when they connect, then all previously connected users' panels update to include the new user.
AC-10: Given a user is listed in the online panel, when that user leaves or disconnects, then all remaining users' panels remove that user within ~200 ms.
AC-11: Given a user is alone in a room, when they view the online panel, then they see only themselves listed.
