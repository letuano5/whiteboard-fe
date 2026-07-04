# Acceptance Criteria

AC-1: A freehand drawing tool must create committed `freehand` elements through the existing
mutation pipeline, store the stroke in `props.points`, and allow the resulting element to be moved
or deleted like other elements.

AC-2: Freehand strokes must simplify raw pointer samples before building the SVG path, so rendered
paths are based on a reduced/smoothed point set instead of one SVG segment per raw pointer sample.

AC-3: Freehand strokes must enforce a per-shape point ceiling; when drawing exceeds the ceiling,
the current stroke is committed automatically and drawing continues in a new `freehand` element.

AC-4: Committed freehand elements must support select-tool move, resize, and rotate interactions;
their point geometry and rendered orientation must update with the same mutation/selection pipeline
used by other editable elements.

AC-5: When a committed freehand element is selected, the selection overlay must show an additional
path that follows the freehand stroke inside the selection box, like tldraw-style selected ink;
this path is a selection affordance, not part of the stored stroke rendering.
