# Acceptance Criteria Registry — Back to Content & Trackpad Support

> Append-only. Never renumber or repurpose an existing AC-n.
> Source: spec.md User Stories + Functional Requirements.

AC-1: When all non-deleted elements are outside the current viewport, the "Back to content" button is visible.
AC-2: When at least one non-deleted element intersects the viewport, the "Back to content" button is NOT shown.
AC-3: When the canvas has no non-deleted elements, the "Back to content" button is NOT shown.
AC-4: Clicking "Back to content" updates the camera so all non-deleted elements are fully visible with uniform padding (~7.5% each side, i.e., PAD=0.85 × viewport per axis).
AC-5: Soft-deleted elements (isDeleted: true) are excluded from visibility checks and from the fit calculation.
AC-6: Wheel events without Ctrl/Cmd held pan the canvas by (deltaX, deltaY) — no zoom occurs.
AC-7: Wheel events with Ctrl/Cmd held (or pinch, where ctrlKey=true) zoom the canvas, not pan.
AC-8: Trackpad zoom sensitivity is reduced — the applied delta factor is ≤ 0.01 per raw wheel unit (smaller than default ~0.05).
AC-9: Zoom is clamped within [0.1, 8] for all zoom operations.
AC-10: While the Select tool is active, the hint text "Click chuột giữa để scroll canvas" is displayed on the canvas.
AC-11: When the user switches to any tool other than Select, the hint text disappears.
AC-12: deltaMode normalization: LINE mode (deltaMode=1) multiplies delta by 16; PAGE mode (deltaMode=2) multiplies by the container dimension before applying.
