# Acceptance Criteria Registry — Room Join & Share Link

> Append-only. Never renumber or repurpose an existing AC-n.
> Source: spec.md acceptance scenarios (distilled 2026-06-27).

AC-1: Visiting the root URL with no `?room=` query parameter shows the home/landing screen, NOT the canvas.
AC-2: Clicking "Create new room" on the home screen navigates to a URL containing a unique `?room=<uuid>` parameter and the canvas is displayed.
AC-3: Opening a URL with `?room=<id>` directly (or reloading it) shows the canvas for that room (not the home screen).
AC-4: When the app mounts with `?room=<id>` in the URL, the client emits a `join-room` Socket.IO event carrying the `roomId` to the server.
AC-5: An element change made by one client in room X is received (and applied via applyRemoteElements) by another client that has joined the same room X.
AC-6: An element change made by a client in room X is NOT received by a client that has joined a different room Y (room isolation).
AC-7: Clicking the "Copy share link" button copies the full current room URL to the system clipboard.
AC-8: After clicking "Copy share link", brief visual confirmation feedback is shown to the user (e.g. button label change or a short-lived notification).
