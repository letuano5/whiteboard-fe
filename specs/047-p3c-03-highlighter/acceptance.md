# Acceptance Criteria

AC-1: A highlighter drawing tool must create committed `highlighter` elements through the existing
mutation pipeline, store the stroke in `props.points`, and keep using the existing SVG ink layer
instead of a separate Canvas or renderer path.

AC-2: Highlighter strokes must use highlighter-specific default styling: semi-transparent opacity
and a wider stroke width than the freehand tool.

AC-3: Highlighter strokes must reuse the freehand point pipeline for raw point simplification,
bounds derivation, and per-shape point-cap splitting during long pointer drags.

AC-4: The toolbar must expose the highlighter as an editing tool, and selecting another tool must
clear an in-progress highlighter draft the same way it clears other transient drawing state.
