# Acceptance Criteria Registry — 005-detail-panel-toolbar (P1A-07 + P1A-08)

> Append-only. Never renumber or repurpose existing AC-n entries.
> Tests must tag coverage with `@covers AC-n` or `@covers AC-n (005-detail-panel-toolbar)`.

## P1A-07: Detail Panel Visibility & Update Contract

AC-1: Detail panel is NOT visible when no shape is selected (selectedIds is empty).
AC-2: Detail panel IS visible when exactly one non-deleted shape is selected.
AC-3: Detail panel is NOT visible when two or more shapes are selected.
AC-4: A property change made in the detail panel is reflected on the canvas immediately (same render frame, no save action required).
AC-5: Every property change in the detail panel goes through patchElement — no direct store mutation.
AC-6: When the detail panel opens, all displayed values match the selected element's current properties in the store.
AC-7: Clicking any control inside the detail panel does NOT deselect the currently selected shape (pointer events do not bubble to the canvas).

## P1A-08: Basic Toolbar

AC-8: The toolbar displays exactly 6 tool buttons: Select, Hand, Rectangle, Ellipse, Line, Text.
AC-9: The currently active tool is visually distinguished from inactive tools (e.g., different background color).
AC-10: Clicking a toolbar tool button sets that tool as the active tool in the interaction store.
AC-11: Clicking any toolbar tool button clears selectedIds to an empty array.
AC-12: Clicking any toolbar tool button clears all transient interaction state: draggingId, dragStart, draftElement, resizeHandle, resizeSession.
