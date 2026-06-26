# Data Model: P1A-02 Select Shape

## Entities involved (no new entities — this feature is purely transient state)

### InteractionStore — modified

| Field | Type | Description |
|-------|------|-------------|
| `selectedIds` | `string[]` | IDs of currently selected elements. Already exists in store; this feature starts writing to it. |

No new fields added to `InteractionStore`. No changes to `Element` or `ElementProps`.

## Derived rendering data (not stored)

When rendering the selection overlay, the following is computed on-the-fly from the selected
element and is NOT stored:

| Derived value | Source | Description |
|---------------|--------|-------------|
| Bounding rect | `shapeUtil.getBounds(element)` | `{x, y, width, height}` in world coords |
| Handle positions | Computed from bounding rect | 8 `{x, y}` world-coord points for circles |

## State transitions

```
No selection  ──[click shape]──▶  Shape selected  ──[click empty]──▶  No selection
                                        │
                                [click other shape]
                                        │
                                        ▼
                                New shape selected
```

## Constraints

- `selectedIds` is always a subset of IDs present in `elements.store.ts`.
- `selectedIds` is never persisted (not written to localStorage).
- `selectedIds` is never broadcast (not included in sync payload).
- In P1A-02, `selectedIds.length` is always 0 or 1 (single-select only).
