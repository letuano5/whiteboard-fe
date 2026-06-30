# Acceptance Criteria

AC-1: The room owner can open a manage-access modal with a dark backdrop, invite an email as `editor` or `viewer`, change a member role, remove a member, and revoke a pending invite.
AC-2: Editors and viewers cannot manage access; the UI hides or disables management actions, and backend HTTP/socket access-management calls from non-owners are rejected.
AC-3: An existing user invited by email can join the room with the invited role.
AC-4: An invite for an email without an account remains pending and is claimed when a user logs in or registers with that email.
AC-5: A viewer does not get edit controls and server-side `ELEMENT_UPDATE` is rejected for that viewer.
AC-6: A private room rejects users who are not the owner, an invited member, or a claimable invitee.
AC-7: A `link_view` room allows anyone with the link to join with `effectiveRole = 'viewer'`.
AC-8: A `link_edit` room allows anyone with the link to edit with `effectiveRole = 'editor'` only when the room is not locked and editor capacity allows it.
AC-9: Revoking a share link removes link-based access so the same link no longer grants room access.
