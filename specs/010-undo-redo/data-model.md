# Data Model: Local Undo / Redo (P1B-06)

## Modified: MutationEvent (src/store/mutation-pipeline.ts)

Additive change — existing hooks are unaffected.

```typescript
export interface MutationEvent {
  type: 'create' | 'patch' | 'delete' | 'update';
  elements: Element[];   // after-state (existing field, unchanged)
  before: Element[];     // before-state (NEW — empty array for createElement)
}
```

## New: HistoryEntry

```typescript
export interface HistoryEntry {
  before: Element[];  // element states before the mutation ([] for create ops)
  after: Element[];   // element states after the mutation
}
```

| Field | Type | Semantics |
|-------|------|-----------|
| `before` | `Element[]` | State to restore on undo. Empty for create ops (undo = delete). |
| `after` | `Element[]` | State to restore on redo. |

## New: HistoryStore state (src/store/history.store.ts)

```typescript
interface HistoryState {
  undoStack: HistoryEntry[];   // index 0 = oldest, last = most-recent
  redoStack: HistoryEntry[];   // index 0 = oldest undo, last = most-recent undo
  isApplying: boolean;         // true while undo/redo is being applied
}

interface HistoryActions {
  push(entry: HistoryEntry): void;  // push to undoStack, clear redoStack, enforce maxSize
  undo(): void;                     // pop undoStack → apply before; push to redoStack
  redo(): void;                     // pop redoStack → apply after; push back to undoStack
}

const MAX_HISTORY_SIZE = 100;
```

### State transitions

```
Initial: undoStack=[], redoStack=[], isApplying=false

User action A:
  push({before:[], after:[A]})
  → undoStack=[{before:[], after:[A]}], redoStack=[]

User action B:
  push({before:[A'], after:[A'']})
  → undoStack=[..., {before:[A'], after:[A'']}], redoStack=[]

Undo:
  entry = undoStack.pop()
  apply entry.before (or delete if before=[])
  redoStack.push(entry)

Redo:
  entry = redoStack.pop()
  apply entry.after
  undoStack.push(entry)

New action after undo:
  push(newEntry) → redoStack is cleared
```

## New: applySnapshot (addition to mutation-pipeline.ts)

```typescript
export function applySnapshot(elements: Element[]): void
```

- Bumps `version`, `versionNonce`, `updatedAt` on each element
- Writes via `useElementsStore.getState().updateElements(bumped)` (the store method — handles isDeleted elements)
- Fires hooks with `{ type: 'update', before: elements, elements: bumped }`
- Called only by history store's `undo()` / `redo()` with `isApplying = true`

## No changes to Element type

The `version`, `versionNonce`, `updatedAt`, `isDeleted` fields in `Element` are unchanged.
AC-14 (version++ on undo/redo) is satisfied by `applySnapshot` bumping version, and by
`deleteElements` (used for undo-of-create) already bumping version.
