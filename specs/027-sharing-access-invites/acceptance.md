# Acceptance Criteria

AC-1: The room owner can open one green Share button, then use the Share modal to add an existing user email as `editor` or `viewer`, change a member role, remove a member, copy the link, and choose exactly one link mode: `private`, `link_view`, or `link_edit`.
AC-2: Editors and viewers cannot manage access; the UI hides or disables management actions, and backend HTTP/socket access-management calls from non-owners are rejected.
AC-3: An existing user added by email can join the room with the assigned role.
AC-4: Adding an email without an existing account is rejected and does not create a pending invitation.
AC-5: Opening an existing private room without permission shows an explicit access error and does not render an empty local/new board.
AC-6: Anonymous users see a top-right `Login` control; authenticated users see a circular avatar with at least a `Sign out` action, positioned to the right of `Share`.
AC-7: A viewer does not get edit controls and server-side `ELEMENT_UPDATE` is rejected for that viewer.
AC-8: A private room rejects users who are not the owner or an added member.
AC-9: A `link_view` room allows anyone with the link to join with `effectiveRole = 'viewer'`.
AC-10: A `link_edit` room allows anyone with the link to edit with `effectiveRole = 'editor'` only when the room is not locked and editor capacity allows it.
AC-11: Revoking a share link removes link-based access so the same link no longer grants room access.
