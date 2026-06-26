# Research: P1A-02 Select Shape

**Date**: 2026-06-23

No external library research required. All technology choices are already documented in
`CLAUDE.md` and the project constitution. This file records only design-level decisions.

## Decision Log

### Hit-test geometry (AABB vs ellipse vs segment)

**Decision**: AABB for all shapes except line; point-to-segment for line.

**Rationale**: At angle=0, AABB is geometrically correct for rectangles, text, and diamond
(bbox). Ellipse hit-test with actual ellipse formula adds complexity for no user-visible gain
in P1A; AABB is a conservative over-approximation that is acceptable in the MVP phase. Line
uses segment distance because its bbox collapses to zero area along one axis.

**Alternatives considered**:
- Exact ellipse hit-test `((px-cx)²/a² + (py-cy)²/b²) ≤ 1`: more precise but more complex;
  deferred to polish phase if users complain.
- Stroke-width-aware hit-test: adds complexity; out of scope for P1A-02.

### Selection overlay: inside SVG camera group vs. HTML overlay

**Decision**: Inside SVG camera-transform `<g>` group.

**Rationale**: Coordinates are in world space; rendering inside the camera group means the
overlay moves and scales with the canvas automatically. An HTML `<div>` overlay would require
re-projecting world coordinates to screen on every frame — unnecessary complexity.

**Alternatives considered**:
- Separate HTML `<div>` absolutely positioned: adds coordinate conversion overhead.
- Separate SVG element with its own transform: redundant; same camera transform applied twice.

### Pointer event routing

**Decision**: Add `tool === 'select'` branch in `Whiteboard.tsx` alongside existing
`isShapeTool(tool)` branch. Select-tool uses only `pointerdown` (no drag in P1A-02).

**Rationale**: Follows the existing pattern (create-shape-tool.ts). Keeps tool logic
self-contained and decoupled from the Whiteboard component.
