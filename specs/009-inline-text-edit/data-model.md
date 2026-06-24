# Data Model — P1B-03 Inline Text Editing

## Modified Entities

### InteractionState (interaction.ts / interaction.store.ts)

Added field:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `editingId` | `string \| null` | `null` | ID of the text element currently open in the inline editor. Transient — never synced or persisted. |

New action:

| Action | Signature | Effect |
|--------|-----------|--------|
| `setEditingId` | `(id: string \| null) => void` | Sets `editingId` in interaction store |

### Element (existing, no structural change)

`props.text`, `width`, and `height` are updated via `patchElement` at commit time. No new fields on the `Element` type.

## State Transitions

```
[editingId = null]
  → user double-clicks text element
  → setEditingId(element.id)
[editingId = element.id]
  → blur or Escape
  → patchElement(id, { props: { text }, width, height })
  → setEditingId(null)
[editingId = null]
```

## Invariants

- `editingId` is always either `null` or the `id` of a non-deleted `text` element.
- At most one element can be edited at a time.
- `editingId` is never written to localStorage or sent over BroadcastChannel/Socket.IO.
