# Research: Local Undo / Redo (P1B-06)

## No external research needed

All dependencies are already in CLAUDE.md or well-established in the codebase:

| Area | Finding |
|------|---------|
| Zustand 5 store pattern | Already in CLAUDE.md: `create<State & Actions>()((set, get) => ({}))` |
| Mutation hook mechanism | `registerMutationHook` in `src/store/mutation-pipeline.ts` — used by localStorage sync |
| Keyboard event pattern | `window.addEventListener('keydown', ...)` in `Whiteboard.tsx`; focus guard already coded |
| Hook registration point | `main.tsx` calls `initLocalStoragePersistence()` at startup — same pattern for history |
| No new npm packages | Feature is pure in-memory TypeScript logic |

## Architecture Decisions

### Decision 1: History capture via enriched MutationEvent

**Decision**: Extend `MutationEvent` with an additive `before: Element[]` field. Each pipeline function captures the before-state from the store before writing, and includes it in the fired hook event.

**Rationale**: Hooks already receive events; adding `before` keeps all history data flowing through the existing event bus. Zero impact on existing hooks (they ignore the new field).

**Alternative rejected**: Having the history store read the store state itself in the hook callback — unreliable because the store is already updated by the time the hook fires.

---

### Decision 2: Suppress history re-entry with `isApplying` flag in history store

**Decision**: `useHistoryStore.getState().isApplying` is `true` while undo/redo is being applied. The history mutation hook bails early when this flag is set.

**Rationale**: Simple, synchronous, no complex locking needed (JS is single-threaded).

**Alternative rejected**: Module-level variable in `mutation-pipeline.ts` — would expose internal flag to callers and break encapsulation.

---

### Decision 3: `applySnapshot` as a pipeline-internal restoration function

**Decision**: Add `applySnapshot(elements: Element[])` to `mutation-pipeline.ts`. It bumps `version`/`versionNonce`/`updatedAt` for each element and writes directly via `useElementsStore.getState().updateElements()` (the store method — which handles both active and soft-deleted elements). Fires hooks with `type: 'update'`.

**Rationale**: Restoring a soft-deleted element requires writing `isDeleted: false` to an element that `patchElement` guards against. The store's own `updateElements` (not the pipeline's) can do this. Keeping this logic inside `mutation-pipeline.ts` preserves the spirit of constitution §VI.

**Alternative rejected**: Calling `deleteElements`/`patchElement`/`createElement` in reverse — complex to compose correctly; create-undo would need a special re-create path that regenerates the same ID (not supported).

---

### Decision 4: History hook registered at startup in `main.tsx`

**Decision**: Export `initHistoryCapture()` from a new `src/sync/history-capture.ts` module. Call it from `main.tsx` alongside `initLocalStoragePersistence()`.

**Rationale**: Mirrors the existing localStorage hook registration pattern exactly.

---

### Decision 5: Max history size = 100, oldest-first eviction

**Decision**: When `undoStack.length >= 100`, the oldest entry (index 0) is discarded before pushing a new one.

**Rationale**: Matches spec FR-006 and SC-004. 100 is the industry standard for in-memory undo stacks.
