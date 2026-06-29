# Data Model: Z-order UI & Arrow Binding

**Feature**: P2.5-02 + P2.5-03 | **Date**: 2026-06-28

## Existing types used (no schema changes)

Both features operate exclusively on the existing `Element` type from `@vdt/shared`. No new types
are added to the shared package.

### `Element` fields used

| Field | Type | Usage |
|-------|------|-------|
| `zIndex` | `number` (integer) | Stacking order; mutated by z-order commands |
| `props.startBinding` | `string \| null \| undefined` | Arrow start-endpoint binding |
| `props.endBinding` | `string \| null \| undefined` | Arrow end-endpoint binding |
| `props.points` | `[number, number][] \| undefined` | Arrow endpoint coordinates (always kept in sync with bindings) |
| `version` | `number` | Incremented by mutation pipeline on every change |
| `versionNonce` | `number` | Re-randomised on every change |
| `updatedAt` | `number` | Set to `Date.now()` on every change |

---

## Binding String Format

```
"<elementId>:<pointKey>"
```

- `elementId`: the `id` of the target shape (any non-arrow element)
- `pointKey`: one of `"center" | "top" | "right" | "bottom" | "left"`

**Examples**:
```
props.startBinding = "abc123:center"   // start endpoint bound to shape abc123's centre
props.endBinding   = "def456:top"      // end endpoint bound to shape def456's top midpoint
props.startBinding = null              // start endpoint is free (unbound)
```

### Attachment Points

Given a target `Element el`, the five canonical attachment points in world coordinates:

| pointKey | x | y |
|----------|---|---|
| `center` | `el.x + el.width / 2` | `el.y + el.height / 2` |
| `top`    | `el.x + el.width / 2` | `el.y` |
| `right`  | `el.x + el.width`     | `el.y + el.height / 2` |
| `bottom` | `el.x + el.width / 2` | `el.y + el.height` |
| `left`   | `el.x`                | `el.y + el.height / 2` |

---

## Binding Lifecycle

```
Arrow endpoint released within ARROW_SNAP_THRESHOLD (20px) of shape S
  → nearestAttachmentPoint(endpoint, S) returns { x, y, pointKey }
  → props.points[i] updated to { x, y }
  → props.startBinding / endBinding set to "S.id:pointKey"
  → patchElement / createElement called

Shape S is moved or resized (via mutation pipeline)
  → arrow-binding-hook fires
  → for each arrow with startBinding or endBinding referencing S.id:
      recompute world position of attachment point from S's NEW geometry
      → updateElements([{ id: arrow.id, patch: { props: { ...arrow.props, points: [...] } } }])

Arrow endpoint dragged beyond ARROW_SNAP_THRESHOLD from any shape
  → props.startBinding / endBinding set to null
  → props.points[i] updated to pointer release position
  → patchElement called

Bound shape S is deleted (isDeleted = true)
  → arrow-binding-hook fires on the soft-delete event
  → for each arrow bound to S: set binding to null; keep props.points at last computed position
  → updateElements([...])
```

---

## Z-order Operations (no new fields)

All four operations read current `zIndex` values from all non-deleted elements and call
`updateElements` with only the changed elements.

```
bringToFront(targetId):
  newZIndex = max(elements.map(e => e.zIndex)) + 1
  updateElements([{ id: targetId, patch: { zIndex: newZIndex } }])

sendToBack(targetId):
  newZIndex = min(elements.map(e => e.zIndex)) - 1
  updateElements([{ id: targetId, patch: { zIndex: newZIndex } }])

bringForward(targetId):
  sorted = elements.sort((a,b) => a.zIndex - b.zIndex)
  above = first element in sorted where zIndex > target.zIndex
  if above exists: updateElements([
    { id: targetId, patch: { zIndex: above.zIndex } },
    { id: above.id, patch: { zIndex: target.zIndex } },
  ])

sendBackward(targetId):
  sorted = elements.sort((a,b) => a.zIndex - b.zIndex)
  below = last element in sorted where zIndex < target.zIndex
  if below exists: updateElements([
    { id: targetId, patch: { zIndex: below.zIndex } },
    { id: below.id, patch: { zIndex: target.zIndex } },
  ])
```
