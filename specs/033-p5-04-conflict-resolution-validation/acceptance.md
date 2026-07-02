# Acceptance Criteria

AC-1: Concurrent move and fill-color updates to the same shape preserve both `transform.position` and fill style slots.
AC-2: Concurrent fill-color and stroke-width updates to the same shape preserve both independent style slots.
AC-3: Concurrent text and style updates to the same shape preserve both the text slot and style slot.
AC-4: Concurrent move and resize updates to the same shape preserve both `transform.position` and `transform.size`.
AC-5: Concurrent move updates to the same shape resolve `transform.position` by latest command committed on the server.
AC-6: Concurrent resize updates to the same shape resolve `transform.size` by latest command committed on the server.
AC-7: Delete wins over any later patch to the deleted element.
AC-8: Viewer actors are rejected at the command boundary before mutation planning.
AC-9: Invalid asset, group, or frame references are rejected before commit so the document cannot become half-valid.
AC-10: Derived or local-only fields, including cache, bounds, selection, and `versionNonce`, are rejected with `INVALID_FIELD`.
AC-11: Linear elements reject independent `transform.*` patches with `INVALID_SLOT_FOR_ELEMENT_TYPE`, and server-side geometry patches normalize bounding boxes from geometry.
AC-12: Commands exceeding patch, delete, repaired-arrow, or change-set size limits are rejected with `TOO_LARGE`.
