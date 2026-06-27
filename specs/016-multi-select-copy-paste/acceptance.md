# Acceptance Criteria Registry — 016 Multi-select + Copy-Paste (P2-08)

> Append-only. Never renumber or repurpose an existing AC-n.

## Marquee Selection

AC-1: Dragging from empty canvas space over N shapes selects exactly those N shapes (and no others).
AC-2: Releasing the mouse after a marquee drag removes the rubber-band rectangle while keeping matched shapes selected.
AC-3: A marquee drag that covers no shapes clears the current selection.

## Shift-click

AC-4: Shift-clicking an unselected shape adds it to the current selection without deselecting others.
AC-5: Shift-clicking an already-selected shape removes it from the selection.
AC-6: Shift-clicking a shape when nothing is selected selects that shape.
AC-7: Clicking empty canvas without Shift clears the entire selection.

## Bulk Operations

AC-8: Dragging any selected shape moves all selected shapes by the exact same (dx, dy) delta.
AC-9: Changing a style property (fill color, stroke color, stroke width) via the style panel applies that change to all selected shapes.
AC-10: Pressing Delete or Backspace removes all currently selected shapes from the canvas.

## Duplicate (Ctrl/Cmd+D)

AC-11: Pressing Ctrl/Cmd+D with one shape selected creates a copy at (+10 px, +10 px) offset; the copy is selected and the original is deselected.
AC-12: Pressing Ctrl/Cmd+D with multiple shapes selected creates copies of all, each at (+10 px, +10 px) offset; copies are selected and originals are deselected.
AC-13: Pressing Ctrl/Cmd+D with nothing selected is a no-op (no shapes created).

## Copy/Paste (Ctrl/Cmd+C / Ctrl/Cmd+V)

AC-14: Pressing Ctrl/Cmd+C stores the selected shapes as deep copies in an in-memory clipboard; the current selection does not change.
AC-15: Pressing Ctrl/Cmd+V with shapes in the clipboard pastes copies at (+10 px, +10 px) offset from clipboard originals; clipboard remains populated.
AC-16: Pressing Ctrl/Cmd+V a second time pastes another set of copies offset by (+20 px, +20 px) from the clipboard originals (each successive paste = pasteCount * 10 px from clipboard origin, not chained from previous paste's position).
AC-17: Pressing Ctrl/Cmd+V with an empty clipboard is a no-op.
