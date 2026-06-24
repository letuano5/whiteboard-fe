# Tasks: localStorage Persistence & Z-Order Foundation (P1A-09 + P1A-10)

**Input**: Design documents from `specs/006-localstorage-zorder/`

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **AC Registry**: [acceptance.md](acceptance.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[US1]**: localStorage persistence (P1A-09)
- **[US2]**: z-order foundation (P1A-10) — tests only, implementation already in codebase

---

## Phase 1: Setup

**Purpose**: Create stub module so tests can import it (allows TDD: tests fail at import before implementation)

- [ ] T001 Create `src/sync/local-storage.ts` stub: export empty `initLocalStoragePersistence(): void` and `startLocalStoragePersistence(): () => void` functions, plus `STORAGE_KEY = 'VDT_WHITEBOARD_SCENE'` constant and `PersistedScene` interface `{ elements: Element[]; camera: Camera }`

---

## Phase 2: User Story 1 — Session Survival After Reload (Priority: P1) 🎯 MVP

**Goal**: `src/sync/__tests__/local-storage.test.ts` exists with all AC-1–AC-7 tests written and FAILING (stub returns nothing yet).

**Independent Test**: Run `pnpm test local-storage` — all tests in this file should exist and fail (not error on import).

> ⚠️ **TDD**: Write all tests FIRST, verify they fail, THEN implement in Phase 3.

### Tests for User Story 1 (write before implementation — must fail first)

- [ ] T002 [US1] Write test for AC-1 in `src/sync/__tests__/local-storage.test.ts`: call `initLocalStoragePersistence()` after seeding `localStorage[STORAGE_KEY]` with a JSON scene containing one element; assert `useElementsStore.getState().elements` contains that element with matching id/type/x/y/props. Tag `// @covers AC-1`

- [ ] T003 [US1] Write test for AC-2 in `src/sync/__tests__/local-storage.test.ts`: seed `localStorage[STORAGE_KEY]` with a scene where `camera = { x: 100, y: 200, zoom: 1.5 }`; call `initLocalStoragePersistence()`; assert `useCameraStore.getState().camera` equals `{ x: 100, y: 200, zoom: 1.5 }`. Tag `// @covers AC-2`

- [ ] T004 [US1] Write test for AC-3 in `src/sync/__tests__/local-storage.test.ts`: seed `localStorage[STORAGE_KEY]` with a scene containing one element with `isDeleted: true`; call `initLocalStoragePersistence()`; assert `useElementsStore.getState().elements` still contains the element (it's stored) but confirm that the SvgLayer filters it out — assert `elements.filter(e => !e.isDeleted)` is empty. Tag `// @covers AC-3`

- [ ] T005 [US1] Write test for AC-4 in `src/sync/__tests__/local-storage.test.ts`: call `startLocalStoragePersistence()`; call `createElement(...)` to create one element; immediately check localStorage — should be empty (debounce not yet fired); use `vi.useFakeTimers()` + `vi.advanceTimersByTime(300)` then assert `localStorage[STORAGE_KEY]` contains the element. Tag `// @covers AC-4`

- [ ] T006 [US1] Write test for AC-5 in `src/sync/__tests__/local-storage.test.ts`: ensure `localStorage` has no `STORAGE_KEY` key; call `initLocalStoragePersistence()`; assert `useElementsStore.getState().elements` is `[]`; assert `useCameraStore.getState().camera` equals `{ x: 0, y: 0, zoom: 1 }`; assert no error thrown. Tag `// @covers AC-5`

- [ ] T007 [US1] Write test for AC-6 in `src/sync/__tests__/local-storage.test.ts`: set `localStorage[STORAGE_KEY] = '{invalid json'`; call `initLocalStoragePersistence()`; assert `useElementsStore.getState().elements` is `[]`; assert no error thrown. Tag `// @covers AC-6`

- [ ] T008 [US1] Write test for AC-7 in `src/sync/__tests__/local-storage.test.ts`: seed `localStorage[STORAGE_KEY]` with a full element containing all fields (id, type, x, y, width, height, angle, zIndex, props with all sub-fields, version, versionNonce, updatedAt, isDeleted: false, groupId: null, frameId: null, locked: false, createdBy: 'test'); call `initLocalStoragePersistence()`; assert the restored element deep-equals the original on every field. Tag `// @covers AC-7`

**Checkpoint**: `pnpm test local-storage` — 7 tests exist, all fail (functions return nothing). ✅

---

## Phase 3: User Story 1 — Implementation

**Goal**: All AC-1–AC-7 tests pass.

### Implementation for User Story 1

- [ ] T009 [US1] Implement helpers in `src/sync/local-storage.ts`: add `isValidScene(value: unknown): value is PersistedScene` type guard (checks `elements` is array, `camera` has numeric x/y/zoom); add `readScene(): PersistedScene | null` (try/catch `JSON.parse`, returns null on any failure); add `writeScene(scene: PersistedScene): void` (try/catch `JSON.stringify` + `localStorage.setItem`, silently ignores QuotaExceededError)

- [ ] T010 [US1] Implement `initLocalStoragePersistence()` in `src/sync/local-storage.ts`: call `readScene()`; if non-null, call `useElementsStore.getState().setElements(scene.elements)` and `useCameraStore.getState().setCamera(scene.camera)`; if null, do nothing (store already defaults to empty + default camera)

- [ ] T011 [US1] Implement `startLocalStoragePersistence()` in `src/sync/local-storage.ts`: declare `let debounceTimer: ReturnType<typeof setTimeout> | null = null` and `const DEBOUNCE_MS = 300`; implement `scheduleWrite()` that clears previous timer and sets a new 300ms timeout calling `flushWrite()`; implement `flushWrite()` that calls `writeScene({ elements: useElementsStore.getState().elements, camera: useCameraStore.getState().camera })`; register a mutation hook via `registerMutationHook(() => scheduleWrite())`; subscribe to camera store changes via `useCameraStore.subscribe((state, prevState) => { if (state.camera !== prevState.camera) scheduleWrite(); })` (camera.store.ts has no subscribeWithSelector, so use manual reference comparison — safe because every camera mutation creates a new object); return cleanup function that calls the unregister functions and clears `debounceTimer`

- [ ] T012 [US1] Wire persistence in `src/main.tsx`: import `initLocalStoragePersistence` and `startLocalStoragePersistence` from `../sync/local-storage`; call `initLocalStoragePersistence()` before `createRoot(...).render(...)`; call `startLocalStoragePersistence()` immediately after (before render, or immediately after — outside React lifecycle)

**Checkpoint**: `pnpm test local-storage` — all 7 tests pass. ✅

---

## Phase 4: User Story 2 — Visual Stacking Order (Priority: P1)

**Goal**: AC-8–AC-11 tests written and passing (implementation already exists in codebase).

**Independent Test**: `pnpm test SvgLayer select-tool mutation-pipeline` — tests for AC-8 through AC-11 all pass.

> These tests should PASS immediately when written because the implementation already exists.

### Tests for User Story 2

- [ ] T013 [P] [US2] Write test for AC-8 in `src/canvas/layers/__tests__/SvgLayer.test.tsx`: render SvgLayer with two elements — elementA (zIndex: 1, type: 'rectangle') and elementB (zIndex: 2, type: 'ellipse'); query all rendered shape elements in the SVG; assert elementA's `<g>` appears before elementB's `<g>` in the DOM (lower zIndex rendered first = behind). Tag `// @covers AC-8`

- [ ] T014 [P] [US2] Write test for AC-9 in `src/canvas/tools/__tests__/select-tool.test.ts`: set up store with two overlapping elements at the same coordinates — elementA (zIndex: 1) and elementB (zIndex: 2), both passing hitTest at world point (50, 50); call `onSelectPointerDown({ x: 50, y: 50 })`; assert `useInteractionStore.getState().selectedIds` is `[elementB.id]`. Tag `// @covers AC-9`

- [ ] T015 [P] [US2] Write test for AC-10 in `src/store/__tests__/mutation-pipeline.test.ts`: pre-populate store with elements having zIndex values [3, 7, 2]; call `createElement(draft)`; assert the new element's zIndex is `8` (max = 7, new = 7+1). Tag `// @covers AC-10`

- [ ] T016 [P] [US2] Write test for AC-11 in `src/store/__tests__/mutation-pipeline.test.ts`: ensure store has zero elements; call `createElement(draft)`; assert the new element's zIndex is `1`. Tag `// @covers AC-11`

**Checkpoint**: `pnpm test` — all AC-8 through AC-11 tests pass. ✅

---

## Phase 5: Polish & Verification

**Purpose**: Full test suite green; all AC-1–AC-11 covered.

- [ ] T017 Run full test suite with `pnpm test` and confirm all tests pass; fix any type errors with `pnpm typecheck`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (US1 Tests)**: Depends on T001 (stub must exist for import); T002–T008 are sequential (same file)
- **Phase 3 (US1 Impl)**: Depends on Phase 2 tests written and failing; T009–T011 can be done together; T012 depends on T009–T011
- **Phase 4 (US2 Tests)**: Independent of Phases 2–3; T013–T016 are all [P] (different files)
- **Phase 5 (Polish)**: Depends on all prior phases

### Within Phase 3

- T009 (helpers) → T010 (init, uses helpers) → T011 (start, uses helpers) → T012 (wire, uses T010+T011)

### Parallel Opportunities

- Phase 2 and Phase 4 can run in parallel (different stories, no shared files)
- T013, T014, T015, T016 can all run in parallel (different test files)

---

## Implementation Strategy

### MVP First (User Story 1)

1. T001: Create stub
2. T002–T008: Write failing tests
3. T009–T012: Implement until all 7 tests pass
4. **Validate**: `pnpm test local-storage` all green → P1A-09 done

### Then Add Z-Order Coverage (User Story 2)

5. T013–T016: Write and run tests (should pass immediately)
6. **Validate**: `pnpm test` all green → P1A-10 done

---

## Notes

- `vi.useFakeTimers()` is required for AC-4 debounce test; reset with `vi.useRealTimers()` in `afterEach`
- Tests must mock `localStorage` via `vi.stubGlobal('localStorage', ...)` or use jsdom's built-in localStorage
- `startLocalStoragePersistence()` returns a cleanup function — call it in `afterEach` to prevent timer/hook leaks between tests
- Camera subscription: `useCameraStore.subscribe(selector, listener)` — vanilla Zustand subscribe with selector (no middleware needed)
- P1A-10 tests that already exist in the repo: check existing `select-tool.test.ts` and `mutation-pipeline.test.ts` to avoid duplicate test names before adding AC-tagged tests
