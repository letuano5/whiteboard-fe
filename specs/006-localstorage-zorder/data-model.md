# Data Model: localStorage Persistence & Z-Order Foundation

**Date**: 2026-06-24

## Persisted Scene Shape

```ts
interface PersistedScene {
  elements: Element[];   // full Element array from elements.store (all fields, including isDeleted)
  camera: Camera;        // { x: number, y: number, zoom: number }
}
```

Stored under localStorage key `VDT_WHITEBOARD_SCENE` as JSON.

### Element (existing — no changes)

See `src/types/shared.ts`. All fields are persisted; no fields are stripped on write.

- **id**: string — stable identifier; restored as-is
- **type**: ElementType — determines which ShapeUtil renders it
- **x, y, width, height**: world coordinates
- **angle**: radians (always 0 in P1A)
- **zIndex**: integer; determines render/hit-test order
- **props**: ElementProps — stroke/fill/text/etc
- **version, versionNonce**: LWW fields; restored as-is
- **updatedAt**: Unix timestamp; restored as-is
- **isDeleted**: soft-delete flag; soft-deleted elements are stored but not shown
- **groupId, frameId, locked, createdBy**: metadata fields; restored as-is

### Camera (existing — no changes)

- **x**: world x offset (number)
- **y**: world y offset (number)
- **zoom**: scale factor, clamped [0.1, 8] by camera.store

## Type Guard (`isValidScene`)

Minimal validation — does not validate every element field:

```ts
function isValidScene(value: unknown): value is PersistedScene {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.elements)) return false;
  if (typeof v.camera !== 'object' || v.camera === null) return false;
  const cam = v.camera as Record<string, unknown>;
  return (
    typeof cam.x === 'number' &&
    typeof cam.y === 'number' &&
    typeof cam.zoom === 'number'
  );
}
```

## zIndex Invariants (P1A-10)

These invariants are upheld by existing code:

| Invariant | Where enforced |
|---|---|
| New shape zIndex = max(existing) + 1 | `mutation-pipeline.ts → createElement` |
| First shape on empty canvas: zIndex = 1 | Same (max of empty set = 0) |
| Render order: ascending zIndex | `SvgLayer.tsx → visible.sort((a,b) => a.zIndex - b.zIndex)` |
| Hit-test priority: descending zIndex | `select-tool.ts → visible.sort((a,b) => b.zIndex - a.zIndex)` |
