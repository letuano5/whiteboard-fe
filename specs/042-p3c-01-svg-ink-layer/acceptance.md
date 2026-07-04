# Acceptance Criteria

AC-1: Freehand and highlighter elements must render through the existing SVG whiteboard layer,
not through a separate Canvas or `ctx.setTransform` render path.

AC-2: Freehand and highlighter rendering must use the same camera-transformed SVG coordinate
system as existing shapes, so their path geometry stays in world coordinates while the parent SVG
layer applies the shared camera transform.
