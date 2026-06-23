# Data Model: Basic Style Panel & Text Properties

## No new entities

This feature edits existing fields of `ElementProps` — no schema changes.

## Relevant existing fields (read + write by DetailPanel)

### All element types

| Field | Type | Range | Control |
|-------|------|-------|---------|
| `strokeColor` | `string` | CSS color hex | `<input type="color">` |
| `fillColor` | `string` | CSS color hex | `<input type="color">` (hidden for `line`) |
| `strokeWidth` | `number` | ≥ 1 | `<input type="number" min=1>` |
| `opacity` | `number` | 0.0 – 1.0 | `<input type="range" 0–100>` scaled |

### Text element only (`element.type === 'text'`)

| Field | Type | Range | Control |
|-------|------|-------|---------|
| `fontSize` | `number` | ≥ 1 | `<input type="number" min=1>` |
| `fontFamily` | `string` | `'sans-serif' \| 'serif' \| 'monospace'` | `<select>` |
| `textAlign` | `'left' \| 'center' \| 'right'` | — | 3-button toggle |

## Mutation shape

```ts
patchElement(element.id, {
  props: { ...element.props, changedField: newValue }
});
```

Merging full `props` object (not partial) prevents accidentally clearing optional fields.
