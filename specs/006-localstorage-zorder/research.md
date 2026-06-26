# Research: localStorage Persistence & Z-Order Foundation

**Date**: 2026-06-24

No external research required. All technology choices are native browser APIs or already established in the project.

## Decisions

| Decision | Choice | Rationale | Alternatives Considered |
|---|---|---|---|
| Persistence API | `window.localStorage` | Native browser API; synchronous; no library; sufficient for P1A single-tab | IndexedDB (async, overkill for P1A); sessionStorage (lost on tab close, not persistent) |
| localStorage key | `VDT_WHITEBOARD_SCENE` | Unique, human-readable, matches project name; easy to inspect/clear in DevTools | UUID key (harder to inspect); per-room key (multi-room not in P1A scope) |
| Save trigger | `registerMutationHook` + `useCameraStore.subscribe` | Mutation hook covers all element edits; camera bypasses pipeline so needs separate subscription | Subscribe to both stores (would need `subscribeWithSelector` middleware; extra complexity); periodic polling (misses changes between polls) |
| Debounce | Single shared 300ms timer | Prevents duplicate writes when action triggers both element mutation and camera change | Per-trigger debounce (two timers, risk of double-write) |
| Restore timing | Before `ReactDOM.createRoot().render()` in `main.tsx` | Store is populated before any React render cycle reads it; no flash of empty canvas | In a `useEffect` in App.tsx (too late; initial render would see empty store) |
| Camera validation on restore | Accept stored values directly, no re-clamp via `zoomTo` | Stored data was clamped when written (camera store enforces clamp on write); no need to re-validate | Re-validate via `zoomTo` (double-clamping; unnecessary indirection) |
| P1A-10 implementation | Test coverage only | All three behaviors (render sort, hit-test sort, createElement max+1) are already in the codebase | Re-implementing (would be duplicate code and tests); skipping tests (violates AC coverage guard) |
