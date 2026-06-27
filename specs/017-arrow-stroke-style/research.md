# Research: Arrow + Stroke Style (P2-09)

**Date**: 2026-06-27

## Summary

No external library or framework research required. All technology is already documented in CLAUDE.md. Key decisions below are derived from the codebase survey.

## Decisions

### Decision 1: Arrow Storage — `props.points` (Reuse Existing Field)

**Decision**: Store arrow endpoints as `props.points: [[x1,y1],[x2,y2]]` — the same field used by `line` and `freehand`.

**Rationale**: The field already exists in `ElementProps`. Arrow behavior is geometrically identical to `line` but with an added arrowhead. Reusing the field avoids a shared-type schema change and keeps the element model uniform.

**Alternatives considered**:
- Dedicated `x1,y1,x2,y2` fields directly on `Element` — rejected because `Element` has a fixed `x,y,width,height` bounding-box schema; adding extra fields would violate the unified element model.

### Decision 2: Arrowhead — Computed SVG Polygon (Not SVG `<marker>`)

**Decision**: Compute arrowhead as an SVG `<polygon>` from the direction vector of the two points. No `<defs><marker>`.

**Rationale**:
- SVG `<marker>` scales oddly with `strokeWidth` and requires `<defs>` to be in the document — it works but adds coupling between the arrowhead definition and the renderer's root `<svg>`.
- A computed polygon is fully self-contained in the ShapeUtil's `render()` method, matches Constitution IV (ShapeUtil encapsulates all rendering), and is easier to test.
- The `strokeDashArray` on the line body does not propagate to `<marker>` elements, so dashed arrow body + solid head would be awkward with markers.

### Decision 3: Hit Test — Point-to-Line Segment Distance

**Decision**: `hitTest` for arrows uses point-to-line-segment distance with threshold `max(8, strokeWidth/2)`.

**Rationale**: Arrow bounding box hit test would trigger on the entire bounding rect including empty corners (arrows that go diagonal would have large empty zones). Line-segment distance is the correct geometric test. Threshold of 8px provides a reasonable click target.

### Decision 4: Stroke Style UI — `<select>` in DetailPanel

**Decision**: Add a `<select>` element with three options (solid / dashed / dotted) to `DetailPanel.tsx` below the stroke-width field.

**Rationale**: Matches the existing style: font family already uses `<select>`. Simple, accessible, consistent.

**Alternatives considered**:
- Icon-button row (like text alignment) — rejected as over-engineering for 3 options that are visually distinguishable by name.

### Decision 5: Arrow Minimum Size — `sqrt(dx²+dy²) >= 2`

**Decision**: Use distance ≥ 2px (not 5px as for rectangles) for arrow validity.

**Rationale**: AC-5 says "< 2 px drag is discarded." The spec is explicit. Existing `isValidSize` uses 5px for rectangles; arrow has its own branch.
