# Acceptance Criteria Registry — Local Undo / Redo (P1B-06)

> **Append-only. Never renumber or repurpose an existing AC-n.**
> Source: `spec.md` User Stories + FR. Distilled 2026-06-25.

## Undo — basic operations (User Story 1)

AC-1: Undoing a create action removes the newly created element from the canvas.
AC-2: Undoing a move action returns the element to its position before the move.
AC-3: Undoing a resize or rotate action reverts the element's dimensions and/or angle.
AC-4: Undoing a soft-delete action restores the deleted element to the canvas (isDeleted becomes false).
AC-5: Undoing a style or text change restores the previous style or text values.
AC-6: Pressing Ctrl/Cmd+Z when the undo stack is empty causes no visible change and no error.

## Redo (User Story 2)

AC-7: Pressing Ctrl/Cmd+Shift+Z after an undo re-applies the undone action on the canvas.
AC-8: Pressing Ctrl/Cmd+Shift+Z when the redo stack is empty causes no visible change and no error.
AC-9: Performing a new canvas mutation after one or more undos clears the redo stack entirely.

## Multi-step and history limits (User Story 3)

AC-10: Pressing Ctrl/Cmd+Z N times after N distinct actions reverses all N actions in reverse-chronological order.
AC-11: After M undos, pressing Ctrl/Cmd+Shift+Z K times (K ≤ M) re-applies K actions in chronological order.
AC-12: When the history stack reaches 100 entries, performing a new action discards the oldest entry so the stack stays at 100.

## Pipeline integration (FR-003, FR-005)

AC-13: Every call to createElement, patchElement, deleteElements, or updateElements is captured as exactly one undoable step.
AC-14: Every undo and redo application increments the version counter on every affected element.

## Keyboard guard (FR-007)

AC-15: The undo/redo keyboard shortcuts produce no effect when focus is inside an input, textarea, select, or contenteditable element.
