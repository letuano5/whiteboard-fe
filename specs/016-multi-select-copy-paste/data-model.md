# Data Model: Multi-select + Duplicate/Copy-Paste (P2-08)

**Date**: 2026-06-27

## New Interaction Store Fields

No changes to `@vdt/shared` `Element` or `ElementProps` types.

### `InteractionState` extensions

```ts
// Existing (unchanged)
selectedIds: string[];       // array already present
marquee: Rect | null;        // already present, now used

// New
clipboard: Element[] | null; // deep clones at Ctrl+C time; null = empty
pasteOffset: number;         // how many times Ctrl+V was pressed since last Ctrl+C
draftElements: Element[];    // transient positions during multi-element drag
```

**Validation rules**:
- `pasteOffset` reset to 0 on each `setClipboard` call.
- `draftElements` cleared on pointer-up / selection change.
- `clipboard` is NOT synced to remote peers (local-only).

## New Mutation Pipeline Function

```ts
// mutation-pipeline.ts
export function createElements(drafts: ElementDraft[]): Element[]
```

- Assigns new `id`, `zIndex`, `version`, `versionNonce`, `updatedAt`, `isDeleted: false` to each draft.
- Calls `addElements` on the elements store.
- Fires ONE `MutationEvent { type: 'create', elements: created[], before: [] }`.
- Returns the created elements (for selection update).

## State Transitions

```
No selection
  ──► click/drag on empty canvas: start marquee drag
  ──► click on element: select that element

Single selection
  ──► shift-click other element: add to selection (→ multi)
  ──► shift-click self: deselect (→ no selection)
  ──► drag: single-element move (draftElement)
  ──► Ctrl+D / C / V: operate on single element

Multi-selection
  ──► shift-click included element: remove it (→ maybe back to single)
  ──► shift-click excluded element: add it
  ──► drag any included element: multi-element move (draftElements[])
  ──► delete/backspace: deleteElements all
  ──► Ctrl+D: duplicate all → new selection is copies
  ──► Ctrl+C: copy all to clipboard
  ──► Ctrl+V (if clipboard): paste → new selection is pastes

Marquee drag
  ──► pointer-up: set selectedIds to intersecting elements; clear marquee
```

## No Schema Changes

`Element`, `ElementProps`, `Camera`, `Presence`, `WS_EVENTS` in `@vdt/shared` are unchanged.
