# Acceptance Criteria Registry — 017 Arrow + Stroke Style (P2-09)

> Append-only. Never renumber or repurpose an existing AC-n.

## Arrow Drawing

AC-1: Dragging the Arrow tool from point A to point B creates an arrow shape with tail at A and a visible filled arrowhead at B.
AC-2: The rendered arrowhead is visually distinct (filled triangular tip) and points in the direction from tail to head.
AC-3: Dragging the tail or head handle of a selected arrow updates that endpoint in real-time.
AC-4: Pressing Delete/Backspace with an arrow selected removes the arrow from the canvas.
AC-5: A drag of less than 2 px (zero-length arrow) is discarded without creating a shape.

## Stroke Style Property

AC-6: Setting stroke style to "dashed" renders the shape's stroke as a dashed line.
AC-7: Setting stroke style to "dotted" renders the shape's stroke as a dotted line.
AC-8: Setting stroke style to "solid" renders the shape's stroke as a continuous solid line.
AC-9: New shapes are created with default stroke style "solid".
AC-10: A shape's stroke style survives a page refresh (persisted in local storage).

## Stroke Style UI

AC-11: The style/detail panel exposes a stroke-style selector when one or more shapes are selected.
AC-12: Changing stroke style via the panel applies to all currently selected shapes, including mixed selections of arrows and other shape types.

## Arrow Common Operations

AC-13: Clicking an arrow selects it and shows handles at tail and head.
AC-17: The toolbar exposes an Arrow tool button that activates the Arrow drawing mode when clicked.
AC-14: Dragging the arrow body (not a handle) moves both tail and head by the same delta.
AC-15: A selected arrow can have its stroke color and stroke width changed through the style panel.
AC-16: A marquee selection that spatially covers an arrow includes the arrow in the multi-selection.
