# Acceptance Criteria

AC-1: Export then import of `.vdt.json` preserves existing element types, styles, zIndex, angle, group/frame metadata, camera, and room metadata.
AC-2: Anonymous import applies to the local board only and does not create a persisted DB room unless the user later chooses login/save.
AC-3: Authenticated import into a saved document is rejected for viewers and permitted only for owner/editor effective roles.
AC-4: Invalid or unsupported native schemas do not crash the app and show a clear validation error.
AC-5: Loading a native file into a board/document that already has data requires explicit confirmation before replacing or merging.
