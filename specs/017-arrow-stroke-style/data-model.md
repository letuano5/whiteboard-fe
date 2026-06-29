# Data Model: Arrow + Stroke Style (P2-09)

**Date**: 2026-06-27

## No Schema Changes to `@vdt/shared`

`Element`, `ElementProps`, `ElementType`, `Camera`, `Presence`, `WS_EVENTS` are all unchanged.

Arrow uses existing fields:

| Field | Value for Arrow |
|-------|----------------|
| `type` | `"arrow"` (already in `ElementType`) |
| `x` | `min(x1, x2)` |
| `y` | `min(y1, y2)` |
| `width` | `abs(x2 - x1)` |
| `height` | `abs(y2 - y1)` |
| `props.points` | `[[x1,y1],[x2,y2]]` — tail, head |
| `props.strokeColor` | line + arrowhead fill color |
| `props.strokeWidth` | line width |
| `props.strokeStyle` | `'solid' \| 'dashed' \| 'dotted'` (existing field) |
| `props.fillColor` | `'transparent'` (arrowhead filled with strokeColor) |
| `angle` | `0` (no rotation for arrows; direction is encoded in points) |

## Stroke Style — Already Implemented at Type Level

`strokeStyle: 'solid' | 'dashed' | 'dotted'` is already in `ElementProps` and already rendered in `rectangle`, `ellipse`, `diamond`, `line` via `strokeDashArray()` from `shapes/utils.ts`.

**This feature**: adds the UI selector to `DetailPanel.tsx` so users can change the value.

## ArrowShapeUtil Interface

```ts
// frontend/src/canvas/shapes/arrow.tsx
export const arrowShapeUtil: ShapeUtil = {
  type: 'arrow',

  render(el: Element): React.ReactElement,
  // Returns: <g> containing <line> (arrow body) + <polygon> (filled arrowhead)

  hitTest(el: Element, x: number, y: number): boolean,
  // True if point (x,y) is within max(8, strokeWidth/2) pixels of the line segment

  getBounds(el: Element): Rect,
  // { x: min(x1,x2), y: min(y1,y2), width: abs(x2-x1), height: abs(y2-y1) }

  resize(el: Element, handle: HandleId, dx: number, dy: number): Partial<Element>,
  // Moves tail or head endpoint based on which corner handle was dragged
}
```

## Arrowhead Geometry Constants

```ts
const ARROW_HEAD_LEN = 12;    // length of arrowhead in canvas units
const ARROW_HEAD_WIDTH = 8;   // width of arrowhead base in canvas units
```

## create-shape-tool.ts Changes

```ts
// Add to SHAPE_TOOLS:
export const SHAPE_TOOLS = ['rectangle', 'ellipse', 'line', 'text', 'arrow'] as const;

// Add arrow branch in buildDraftFromPoints:
// Arrow is handled identically to 'line':
//   points: [[start.x, start.y], [current.x, current.y]]
//   bounding box computed from min/max of points

// Add arrow branch in isValidSize:
//   sqrt(dx² + dy²) >= 2   (vs. 5 for rectangles)
```
