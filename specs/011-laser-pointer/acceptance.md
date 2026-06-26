# Acceptance Criteria Registry — Laser Pointer (P1B-04)

> **IMMUTABLE REGISTRY** — AC numbers are append-only. Never renumber or repurpose an existing AC.
> New criteria get higher numbers. Tests tag themselves `@covers AC-n`.

---

AC-1: Given the laser tool is active, when the user moves the mouse over the canvas, then a colored trail appears along the cursor path within one animation frame.

AC-2: Given a laser trail is visible, when approximately 1.5 seconds elapse with no new pointer movement (1s delay + 0.5s fade), then the trail fades out and disappears completely with no manual action required.

AC-3: Given the laser tool is active, when the user resumes movement after a pause, then the trail continues accumulating from the current cursor position and the fade timer is reset (trail stays fully visible while the user is actively moving).

AC-4: Given the toolbar is visible, when the user clicks the laser tool button, then the laser tool becomes active (button is highlighted) and the cursor changes to crosshair style.

AC-5: Given the laser tool is active, when the user clicks any other tool in the toolbar, then the laser trail is cleared immediately from the screen and the new tool becomes active.

AC-6: Given a laser trail was drawn, when the page is reloaded, then no laser trail is visible (the trail was never persisted to localStorage or elements store).

AC-7: Given the laser tool is active and a visible trail exists, when the trail auto-fades, then the elements store contains no new entries (the trail was never added to committed state).

AC-8: Given the laser trail is rendered, when the camera zoom is between 0.1× and 8×, then the trail appears correctly aligned with the cursor position at all zoom levels.

AC-9: Given the laser tool is active and a trail is being drawn, when the pointer moves outside the canvas SVG boundary, then the trail stops accumulating and any in-progress trail is cleared immediately.
