# Data Model: Point-Based Model for Linear Elements

**Date**: 2026-06-29

## Element (unchanged schema)

The `Element` interface in `@vdt/shared` is **not changed**. `x`, `y`, `width`, `height` remain
fields on the struct. What changes is the **semantic contract** for `arrow` and `line` elements:

| Field | Before | After |
|-------|--------|-------|
| `props.points` | Optional; may diverge from bbox | **Source of truth** for arrow/line geometry |
| `x`, `y` | May differ from point cloud bbox | Always equals `min(points.x)`, `min(points.y)` |
| `width` | May differ from point cloud span | Always equals `max(points.x) - min(points.x)` |
| `height` | May differ from point cloud span | Always equals `max(points.y) - min(points.y)` |

For non-linear element types (rectangle, ellipse, text, diamond, etc.) nothing changes.

## Derived values

### `normalizeLinearBounds(points: [number, number][]): { x, y, width, height }`

Pure function. Given a list of world-coordinate points, returns the tight axis-aligned bounding box.

- Empty list → `{ x: 0, y: 0, width: 0, height: 0 }`
- Single point → `{ x: px, y: py, width: 0, height: 0 }`
- Two or more points → tight bbox of all points

### Where normalization runs

1. **`createElement` / `createElements`** in `mutation-pipeline.ts` — applied after ID/version
   assignment, before the element is added to the store.
2. **`patchElement`** in `mutation-pipeline.ts` — applied to the merged element after version bump,
   before the store update.
3. **`updateElements`** in `mutation-pipeline.ts` — applied per-element in the reduce loop.
4. **`getBounds` in `arrowShapeUtil` and `lineShapeUtil`** — recomputes on every render from
   `props.points` so the selection overlay always reflects the live geometry.

`applySnapshot` in the pipeline does **not** call normalization (it mirrors exactly what the server
sends; the server-side state is assumed already normalised or will be normalised on first mutation).

## Interaction state additions

### `HandleId` extension (types/interaction.ts)

```
type EndpointHandleId = 'ep-start' | 'ep-end';
type HandleId = ResizeHandleId | 'rotate' | EndpointHandleId;
```

`ResizeHandleId` is unchanged: `'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'`

### `InteractionState.resizeHandle` widened

```
resizeHandle: HandleId | null   // was: ResizeHandleId | null
```

All other `InteractionState` fields are unchanged.

## Endpoint handles (transient, never persisted)

| Handle ID | Maps to | Position |
|-----------|---------|----------|
| `ep-start` | `props.points[0]` | `[x1, y1]` world coordinates |
| `ep-end` | `props.points[length-1]` | `[x2, y2]` world coordinates |

Handles are rendered as SVG circles with `r=5` in `SelectionOverlay` only when
`element.type === 'arrow' || element.type === 'line'`.

## Entity summary

| Entity | Location | Role |
|--------|----------|------|
| `normalizeLinearBounds` | `frontend/src/utils/geometry.ts` | Pure function: points → bbox |
| `arrowShapeUtil.getBounds` | `frontend/src/canvas/shapes/arrow.tsx` | Derive bounds from points for rendering/hit |
| `lineShapeUtil.getBounds` | `frontend/src/canvas/shapes/line.tsx` | Same |
| `EndpointHandleId` | `frontend/src/types/interaction.ts` | Type for endpoint handles |
| `SelectionOverlay` | `frontend/src/canvas/layers/SvgLayer.tsx` | Renders 2 endpoint handles for arrow/line |
