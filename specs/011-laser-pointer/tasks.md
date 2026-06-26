# Tasks: Laser Pointer (P1B-04)

**Input**: Design documents from `specs/011-laser-pointer/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [research.md](./research.md)

**Tests**: TDD — one test per AC-n (AC-1 through AC-8). Tests written first and must FAIL before implementation.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to
- File paths are relative to `src/`

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: State and logic layer that all user stories depend on.

**⚠️ CRITICAL**: Complete this phase before any user story implementation.

- [ ] T001 Update `src/types/interaction.ts` — add `laserFading: boolean` to `InteractionState` interface
- [ ] T002 Update `src/store/interaction.store.ts` — add `laserFading: false` to DEFAULT_STATE and `setLaserFading: (v) => set({ laserFading: v })` action
- [ ] T003 Create `src/canvas/tools/laser-tool.ts` — export `onLaserPointerMove(pt: Point): void`, `onLaserPointerLeave(): void`, `clearLaserTrail(): void`; use two module-level timer refs (`fadeTimer`, `clearTimer`); cap trail at 80 points; fadeTimer fires at 1000ms → `setLaserFading(true)`; clearTimer fires at 1500ms → `setLaserTrail([])` + `setLaserFading(false)`; reset both timers on each move

**Checkpoint**: Types updated, store has `laserFading`, `laser-tool.ts` exists. User story implementation can begin.

---

## Phase 2: User Story 1 — Draw Laser Trail (Priority: P1) 🎯 MVP

**Goal**: Trail appears on mouse move, auto-fades after ~1.5s, starts fresh after pause.

**Independent Test**: Select laser tool → move mouse → trail appears → stop → trail fades and disappears.

### Tests for User Story 1 ⚠️ Write FIRST — verify FAIL before T007

- [ ] T004 [P] [US1] Write test `@covers AC-1` in `src/canvas/tools/__tests__/laser-tool.test.ts` — given laser tool active, calling `onLaserPointerMove` with a point, then `useInteractionStore.getState().laserTrail` contains that point (trail appears on move)
- [ ] T005 [P] [US1] Write test `@covers AC-2` in `src/canvas/tools/__tests__/laser-tool.test.ts` — given trail has points, after 1500ms (use fake timers `vi.useFakeTimers()`), `laserTrail` is empty and `laserFading` is false (trail auto-clears)
- [ ] T006 [P] [US1] Write test `@covers AC-3` in `src/canvas/tools/__tests__/laser-tool.test.ts` — given trail exists and timers are pending, calling `onLaserPointerMove` again resets both timers (trail stays while user is active)

### Implementation for User Story 1

- [ ] T007 [US1] Update `src/canvas/Whiteboard.tsx` — in `handlePointerMove`: when `tool === 'laser'`, call `onLaserPointerMove(screenToWorld(local.x, local.y, camera))`; in `handlePointerDown`: when `tool === 'laser'`, capture pointer and call `onLaserPointerMove` with start point; in `handlePointerUp` and `handlePointerLeave`: when `tool === 'laser'`, call `onLaserPointerLeave()`; add `tool === 'laser'` to cursor style: `'crosshair'` (alongside existing `hand`/`spaceDown` checks)
- [ ] T008 [US1] Update `src/canvas/layers/SvgLayer.tsx` — read `laserTrail` and `laserFading` from `useInteractionStore`; inside the camera-transformed `<g>`, render `<polyline>` when `laserTrail.length >= 2` with `points={laserTrail.map(p => \`${p.x},${p.y}\`).join(' ')}`, `stroke="#ef4444"`, `strokeWidth={3}`, `strokeLinecap="round"`, `strokeLinejoin="round"`, `pointerEvents="none"`, `opacity={laserFading ? 0 : 1}`, `style={{ transition: laserFading ? 'opacity 0.5s ease-out' : 'none' }}`

**Checkpoint**: Laser trail appears on move and auto-fades after ~1.5s. Tests AC-1, AC-2, AC-3 pass.

---

## Phase 3: User Story 2 — Toolbar Access (Priority: P2)

**Goal**: Laser tool is selectable from the toolbar; switching away clears the trail.

**Independent Test**: Toolbar shows laser (Zap) button → click it → laser active → click Select → trail cleared.

### Tests for User Story 2 ⚠️ Write FIRST — verify FAIL before T011

- [ ] T009 [P] [US2] Write test `@covers AC-4` in `src/components/toolbar/__tests__/Toolbar.test.tsx` — rendering Toolbar and clicking the laser button sets `tool` to `'laser'` in interaction store
- [ ] T010 [P] [US2] Write test `@covers AC-5` in `src/components/toolbar/__tests__/Toolbar.test.tsx` — given laser tool is active and `laserTrail` has points, clicking another tool button calls `clearLaserTrail` (trail is empty immediately after switch)

### Implementation for User Story 2

- [ ] T011 [US2] Update `src/components/toolbar/Toolbar.tsx` — import `Zap` from `lucide-react`; import `clearLaserTrail` from `../../canvas/tools/laser-tool`; add `{ id: 'laser', label: 'Laser', Icon: Zap }` to TOOLS array; in `chooseTool()` call `clearLaserTrail()` before `setTool(id)` to ensure trail is cleared when switching away

**Checkpoint**: Toolbar has laser button. Clicking another tool immediately clears any active trail. Tests AC-4, AC-5 pass.

---

## Phase 4: User Story 3 — No Persistence (Priority: P1)

**Goal**: Laser trail never enters the elements store, never persists to localStorage, never survives reload.

**Independent Test**: Use laser tool → open DevTools → verify elements store unchanged → reload → no trail visible.

### Tests for User Story 3 ⚠️ Write FIRST — verify FAIL before implementation note

- [ ] T012 [P] [US3] Write test `@covers AC-6` in `src/canvas/tools/__tests__/laser-tool.test.ts` — after `onLaserPointerMove` calls, `useElementsStore.getState().elements` has the same length as before (trail never added to elements store)
- [ ] T013 [P] [US3] Write test `@covers AC-7` in `src/canvas/tools/__tests__/laser-tool.test.ts` — after `onLaserPointerMove` calls and advance timers past 1500ms, `localStorage.getItem('elements')` (or the store key) is unchanged (trail never persisted)
- [ ] T014 [P] [US3] Write test `@covers AC-8` in `src/canvas/layers/__tests__/SvgLayer.test.tsx` (React component test) — render SvgLayer with `laserTrail = [{ x: 100, y: 200 }, { x: 150, y: 250 }]`, assert the polyline `points` attribute contains `"100,200 150,250"` (raw world coordinates — camera transform is applied by the parent `<g>`, points must NOT be pre-transformed)

### Implementation for User Story 3

- [ ] T015 [US3] Verify (read-only check) `src/canvas/tools/laser-tool.ts` imports only from `interaction.store` — confirm `createElement`, `patchElement`, `deleteElements`, `updateElements` are NOT imported; confirm `localStorage` is NOT touched; add a code comment if any future maintainer might be tempted to persist the trail
- [ ] T016 [US3] Verify `src/sync/` files are not modified — laser trail must not appear in any BroadcastChannel or Socket.IO emit path; run `grep -r "laserTrail\|laser" src/sync/` to confirm no references

**Checkpoint**: AC-6, AC-7, AC-8 tests pass. Trail provably stays transient.

---

## Phase 5: User Story — Canvas Boundary (AC-9)

**Goal**: Trail stops and clears when pointer leaves the canvas.

**Independent Test**: Activate laser, move to canvas edge, exit canvas SVG → trail disappears.

### Test for AC-9

- [ ] T021 [P] Write test `@covers AC-9` in `src/canvas/tools/__tests__/laser-tool.test.ts` — given `laserTrail` has points after `onLaserPointerMove` calls, calling `onLaserPointerLeave()` sets `laserTrail` to `[]` and `laserFading` to `false` immediately (without waiting for timers)

### Implementation note

- Already handled: T007 wires `onLaserPointerLeave()` in `handlePointerLeave` of Whiteboard.tsx — no additional code needed if T007 is implemented correctly.

**Checkpoint**: AC-9 test passes; pointer-leave behavior verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T017 [P] Run `pnpm typecheck` — fix any TypeScript errors introduced by `laserFading` additions
- [ ] T018 [P] Run `pnpm lint` — fix any ESLint warnings in new/modified files
- [ ] T019 Run full test suite `pnpm test` — verify no regressions in existing tests (select-tool, create-shape, undo-redo, etc.)
- [ ] T020 Manual validation per `specs/011-laser-pointer/quickstart.md` — verify all 6 scenarios pass in the running dev server
- [ ] T022 Verify `grep -r "laserTrail\|laser" src/sync/` returns no results — confirm trail is not referenced in any sync/broadcast path (manual QA step, not automated)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately
- **User Story 1 (Phase 2)**: Depends on Phase 1 (T001–T003)
- **User Story 2 (Phase 3)**: Depends on Phase 1 (T003 for `clearLaserTrail`)
- **User Story 3 (Phase 4)**: Depends on Phase 2 and Phase 3 (needs laser tool wired in Whiteboard + Toolbar)
- **Polish (Phase 5)**: Depends on all prior phases

### User Story Dependencies

- **US1 (Draw Trail)**: Needs T001, T002, T003 — direct implementation
- **US2 (Toolbar)**: Needs T003 (`clearLaserTrail`) — can run in parallel with US1 implementation
- **US3 (No Persistence)**: Mostly verification — most of the guarantee is in the design of laser-tool.ts

### Parallel Opportunities

Within Phase 2: T004, T005, T006 (test writing) can all run in parallel.
Within Phase 3: T009, T010 (test writing) can run in parallel.
Within Phase 4: T012, T013, T014 (test writing) can all run in parallel.
T007 and T008 can run in parallel (different files).
T017 and T018 (typecheck + lint) can run in parallel.

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 (T001–T003)
2. Write tests T004–T006, verify FAIL
3. Implement T007–T008
4. Verify T004–T006 pass → **Trail working end-to-end**

### Full Feature

1. MVP above → then Phase 3 (toolbar)
2. Then Phase 4 (persistence verification)
3. Then Phase 5 (polish + regression)

---

## Notes

- `[P]` tasks = different files, no blocking inter-dependencies
- TDD: all test tasks (T004–T006, T009–T010, T012–T014) MUST be written BEFORE their implementation tasks
- T016 is a verification (grep) task, not a code-change task — if grep finds laserTrail in sync files, that is a bug to fix
- `laserTrail` points are world coordinates; the camera transform is applied by SvgLayer's `<g>` — do NOT pre-transform in laser-tool.ts
