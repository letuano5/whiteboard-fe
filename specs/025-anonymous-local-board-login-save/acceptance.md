# Acceptance Criteria

AC-1: Anonymous user can open a local-only board and draw without signing in.
AC-2: Local-only board changes persist after reload in the same browser.
AC-3: A second tab opened to the local-only board receives same-browser changes through BroadcastChannel.
AC-4: Local-only board does not initialize Socket.IO, does not send room mutations, and has no persisted room id.
AC-5: Anonymous local-only board does not create `Room`, `Record`, `Tombstone`, or `RoomMember` rows in the database.
AC-6: `Login to save` is visible only on the local-only board; saved documents opened with `?room=<uuid>` do not show it.
AC-7: Clicking `Login to save` presents the login flow without discarding the current local board; after successful login the user is asked to confirm saving.
AC-8: Confirming save creates a new persisted room, imports the current local elements through the backend persistence path, and assigns the authenticated user as owner.
AC-9: Converted saved document preserves the visible canvas content, zIndex, version metadata, deleted/tombstone semantics needed by current persistence, and current camera state.
AC-10: Canceling the post-login save confirmation keeps the board in local-only mode and does not create a persisted room.
AC-11: If login or save fails, local board data remains intact and the user sees a clear error.
