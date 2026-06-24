# Data Model: Detail Panel & Basic Toolbar (P1A-07 + P1A-08)

**Date**: 2026-06-24

No new data entities are introduced by this feature. P1A-07 and P1A-08 read and write existing store slices.

## Existing entities consumed

### Element (read by DetailPanel)

Defined in `src/types/shared.ts`. Key fields for this feature:

| Field | Type | Role |
|-------|------|------|
| `id` | `string` | Uniquely identifies the selected element |
| `type` | `ElementType` | Determines which controls appear (e.g., text-only controls for `type='text'`) |
| `props` | `ElementProps` | All visual properties edited by the panel |
| `isDeleted` | `boolean` | Panel treats `isDeleted=true` elements as "not selected" |

### ElementProps (mutated via patchElement)

| Field | Type | Controls |
|-------|------|----------|
| `strokeColor` | `string` | Color picker |
| `fillColor` | `string` | Color picker (hidden for `line`) |
| `strokeWidth` | `number` | Number input (min 1) |
| `opacity` | `number` | Range slider 0–100 → 0.0–1.0 |
| `fontSize?` | `number` | Number input (text only, min 1) |
| `fontFamily?` | `string` | Select: sans-serif / serif / monospace |
| `textAlign?` | `'left'\|'center'\|'right'` | Button group (text only) |

### InteractionState (read and written by Toolbar)

Defined in `src/types/interaction.ts`. Fields relevant to this feature:

| Field | Type | Role |
|-------|------|------|
| `tool` | `ToolId` | Active tool; read for highlight, written on click |
| `selectedIds` | `string[]` | Cleared on tool switch; read by DetailPanel to determine visibility |
| `draggingId` | `string\|null` | Cleared on tool switch |
| `dragStart` | `Point\|null` | Cleared on tool switch |
| `draftElement` | `Element\|null` | Cleared on tool switch |
| `resizeHandle` | `ResizeHandleId\|null` | Cleared on tool switch |
| `resizeSession` | `ResizeSession\|null` | Cleared on tool switch |

## State transitions

```
Selection changes → InteractionState.selectedIds → DetailPanel shows/hides
User edits panel  → patchElement(id, {props: {...}}) → elements.store → re-render
User clicks tool  → Toolbar.chooseTool(id) → interaction.store.setTool + clears all transient fields
```
