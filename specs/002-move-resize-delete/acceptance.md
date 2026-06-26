# Acceptance Criteria Registry: P1A-03 Move / Resize / Delete

**Conductor-owned. Append-only. Never renumber or repurpose existing AC-n.**
**Source**: `specs/002-move-resize-delete/spec.md` (User Stories 1–3 acceptance scenarios)

---

## Move (Story 1)

AC-1: Given a shape is selected and the select tool is active, when the user drags the shape body by (dx, dy) world units, then the shape visually follows the pointer (the live preview position is `{x: el.x + dx, y: el.y + dy}`); the committed store `x`/`y` is updated on pointer release (see AC-2).

AC-2: Given a shape is being dragged, when the pointer is released, then the element in the store has the updated `x`/`y`, an incremented `version`, and a new `versionNonce`.

AC-3: Given no shape is selected, when the user presses the pointer on the canvas, then no drag-move interaction begins.

## Resize (Story 2)

AC-4: Given a shape is selected, when the user drags the `se` handle by (dx, dy), then `width` changes by `+dx`, `height` changes by `+dy`, and `x`/`y` are unchanged.

AC-5: Given a shape is selected, when the user drags the `nw` handle by (dx, dy), then `x` changes by `+dx`, `y` changes by `+dy`, `width` changes by `−dx`, `height` changes by `−dy`.

AC-6: Given a shape is selected, when the user drags the `n` handle by (0, dy), then `y` changes by `+dy`, `height` changes by `−dy`, and `x`/`width` are unchanged.

AC-7: Given a resize drag would reduce `width` or `height` below 1 world unit, then the dimension is clamped to 1 (the shape does not invert or reach zero size).

AC-8: Given a shape is being resized, when the pointer is released, then the element in the store reflects the final dimensions with `version` incremented and a new `versionNonce`.

## Delete (Story 3)

AC-9: Given one shape is selected, when the user presses `Delete` or `Backspace`, then the shape's `isDeleted` becomes `true` in the store.

AC-10: Given a shape has been soft-deleted (`isDeleted = true`), then it is no longer rendered on the canvas.

AC-11: Given a shape has been deleted, then `selectedIds` in the interaction store is cleared to `[]`.

AC-12: Given no shape is selected, when the user presses `Delete` or `Backspace`, then no state change occurs (no-op).

## Point Geometry Consistency

AC-13: Given a line stores its rendered geometry as absolute points, when the line is moved by (dx, dy), then every point is translated by (dx, dy) and the committed bounding box and points remain aligned.

AC-14: Given a line stores its rendered geometry as absolute points, when the line is resized from a selection handle, then its points are transformed into the resized bounding box and committed together with `x`, `y`, `width`, and `height`.

## Resize With Flip

Clarification for AC-7: the 1-world-unit clamp applies at or immediately around the fixed anchor. Crossing the anchor is not blocked; crossing behavior is governed by AC-15 through AC-19.

AC-15: Given any corner handle is dragged across the fixed anchor horizontally, then the shape continues resizing on the opposite horizontal side, the logical handle flips horizontally, and stored width remains positive.

AC-16: Given any corner handle is dragged across the fixed anchor vertically, then the shape continues resizing on the opposite vertical side, the logical handle flips vertically, and stored height remains positive.

AC-17: Given any corner handle is dragged across both axes of the fixed anchor, then the logical handle flips on both axes and the normalized bounding box spans the anchor and pointer with positive dimensions.

AC-18: Given a line or other point-based shape is resized across an anchor, then its absolute points are mirrored on each crossed axis, with the fixed anchor and dragged point remaining geometrically consistent.

AC-19: Given a resize is in progress, then the selection border and handles use the live draft bounds and remain attached to the shape before and after a flip.
