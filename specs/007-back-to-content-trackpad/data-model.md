# Data Model: Back to Content & Trackpad Support

No new data entities. No changes to the `Element`, `Camera`, or `InteractionState` types.

## Derived Values (view-layer only, not stored)

### ContentBounds
Computed from `elements[]` filtered to `!isDeleted`:
```
{ minX: number; minY: number; maxX: number; maxY: number } | null
```
`null` when no non-deleted elements exist.

### ShowBackToContent (boolean)
`true` when:
- `ContentBounds !== null` (canvas has content)
- AND no non-deleted element intersects the current viewport rectangle

### ShowSelectHint (boolean)
`true` when `interaction.tool === 'select'`

## New utility functions (src/utils/camera.ts)

```ts
// Returns the axis-aligned bounding box of all non-deleted elements, or null if none exist.
getContentBounds(elements: Element[]): { minX: number; minY: number; maxX: number; maxY: number } | null

// Returns true if any non-deleted element intersects the viewport rectangle.
isAnyElementVisible(elements: Element[], camera: Camera, viewportW: number, viewportH: number): boolean

// Returns a new Camera that fits all non-deleted elements in the viewport with padding.
fitToContent(elements: Element[], camera: Camera, viewportW: number, viewportH: number): Camera
```

## Constants (src/utils/camera.ts)

```ts
const ZOOM_SENSITIVITY = 0.001;   // AC-8: ≤ 0.01 per raw wheel unit
const FIT_PADDING = 0.85;          // 85% viewport fill → ~7.5% padding each side
```
