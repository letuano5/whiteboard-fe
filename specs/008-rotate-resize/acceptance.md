# Acceptance Criteria Registry: Rotate + Correct Resize/Hit-Test for Rotated Shapes

> **APPEND-ONLY. Never renumber or repurpose existing AC-n.**
> New criteria are appended with the next sequential number.

## Rotate Interaction

AC-1: While dragging the rotate handle, the shape's visual rotation updates in real time around its bounding-box center (draft preview is visible during drag).
AC-2: When the rotate drag ends, `patchElement` is called with the updated `angle` (in radians) and the shape renders at the new angle and remains rotated after re-selection.
AC-3: Rotating a shape exactly 90° clockwise results in a stored `angle` of approximately `π/2` radians (within floating-point tolerance).
AC-4: All supported shape types (rectangle, ellipse, line, text) can be rotated via the rotate handle without any type-specific branching in core canvas code.

## Hit-Test for Rotated Shapes

AC-5: Clicking a point inside the rendered (rotated) body of a shape selects that shape.
AC-6: Clicking a point that is inside the original axis-aligned bounding box but clearly outside the rotated shape body does NOT select the shape.
AC-7: When multiple rotated shapes overlap at the clicked point, the shape with the highest `zIndex` is selected.

## Resize for Rotated Shapes

AC-8: While resizing a rotated shape via a handle, the shape resizes in its local (rotated) coordinate frame and the opposite corner/edge remains anchored in world space (draft preview is visible during drag).
AC-9: When a resize drag ends, `patchElement` is called with the updated `x`, `y`, `width`, `height`; the `angle` is unchanged.
AC-10: If a resize drag would produce negative `width` or `height`, the bbox is normalized to positive dimensions and the logical handle flips to the opposite side.
AC-11: For elements with `props.points` (line, polygon), resize scales and mirrors the points array so the visual geometry matches the new bbox.

## Regression Guard

AC-12: Shapes with `angle = 0` behave identically to Phase 1A — no change in hit-test or resize behavior.
AC-13: Rotate and resize mutations are persisted to localStorage and restored correctly on page reload.
