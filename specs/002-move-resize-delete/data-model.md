# Data Model: P1A-03 Move / Resize / Delete

**Date**: 2026-06-23

## Entities Affected

### Element (committed store — `elements.store.ts`)

No new fields. The feature mutates existing fields via the pipeline:

| Field | Type | Mutated by |
|-------|------|-----------|
| `x` | `number` | Move (patchElement), Resize for left-edge handles |
| `y` | `number` | Move (patchElement), Resize for top-edge handles |
| `width` | `number` | Resize (patchElement) |
| `height` | `number` | Resize (patchElement) |
| `isDeleted` | `boolean` | Delete (deleteElements — soft delete, sets to true) |
| `version` | `number` | Auto-incremented by pipeline on every patchElement/deleteElements |
| `versionNonce` | `number` | Auto-randomized by pipeline on every mutation |
| `updatedAt` | `number` | Auto-set to Date.now() by pipeline |

### InteractionState (transient — `interaction.store.ts`)

Three fields to **add** (they appear in `InteractionState` type in `src/types/interaction.ts` but may not be in the store yet):

| Field | Type | Purpose |
|-------|------|---------|
| `draggingId` | `string \| null` | ID of element being moved or resized; null = idle |
| `dragStart` | `{ x: number; y: number } \| null` | World-space pointer position at drag start |
| `resizeHandle` | `HandleId \| null` | Active resize handle; null = body (move) drag |

`draftElement` already exists in the store — reused to hold the in-flight preview copy during drag.

## State Transitions

```
Idle
  │  pointerDown on shape body (selectedId exists)
  ▼
Dragging (move)          draggingId = id, dragStart = worldPt, resizeHandle = null
  │  pointerMove         draftElement = {el, x: el.x + dx, y: el.y + dy}
  │  pointerUp           patchElement(id, {x, y}); draggingId = null, dragStart = null, draftElement = null
  ▼
Idle

Idle
  │  pointerDown on handle (selectedId exists)
  ▼
Resizing                 draggingId = id, dragStart = worldPt, resizeHandle = handleId
  │  pointerMove         draftElement = {el, x: newX, y: newY, width: newW, height: newH}
  │  pointerUp           patchElement(id, {x, y, width, height}); clear all drag state
  ▼
Idle

Idle (with selectedId)
  │  keydown Del/Backspace
  ▼
  deleteElements([id]); setSelectedIds([]); → Idle
```

## Validation Rules

- `width ≥ 1` world unit (enforced in select-tool, before calling patchElement)
- `height ≥ 1` world unit (same)
- No validation needed on `x`/`y` (infinite canvas, any coordinate allowed)
