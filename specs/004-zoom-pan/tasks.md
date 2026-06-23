# Tasks: Zoom + Pan + Infinite Canvas (P1A-06)

**Input**: Design documents from `specs/004-zoom-pan/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, acceptance.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup (No blocking prerequisites needed)

**Purpose**: This feature has no project-init or new-library setup. All infrastructure is already in place. This phase is intentionally empty — skip to Phase 2.

---

## Phase 2: Foundational — Whiteboard event plumbing

**Purpose**: Core wiring required before any pan/zoom behaviour can land. All subsequent phases depend on these.

**⚠️ CRITICAL**: Must complete before any user-story implementation.

- [ ] T001 Add `svgRef = useRef<SVGSVGElement>(null)` to `Whiteboard.tsx` and attach it to the `<svg>` element via `ref={svgRef}` in `src/canvas/Whiteboard.tsx`
- [ ] T002 Add `spaceDown` (`useState<boolean>(false)`) and `isPanning` (`useState<boolean>(false)`) to `Whiteboard.tsx`; add `panStart = useRef<{x:number;y:number}|null>(null)` in `src/canvas/Whiteboard.tsx`
- [ ] T003 Reorder `handlePointerDown` in `Whiteboard.tsx` so that the pan-trigger check executes FIRST, before the `!(e.target instanceof SVGElement)` guard in `src/canvas/Whiteboard.tsx`

**Checkpoint**: `svgRef`, state, and pointer-handler order are ready — user stories can now be implemented.

---

## Phase 3: User Story 1 — Scroll-wheel Zoom (Priority: P1) 🎯 MVP

**Goal**: Scroll wheel zooms canvas around the cursor position; zoom is clamped to [0.1, 8].

**Independent Test**: Open the whiteboard, place a shape, hover over it, scroll up then down — the shape stays under the cursor; zoom clamps at 8 and 0.1.

### Tests for User Story 1

> Write tests FIRST; confirm they FAIL before implementing.

- [ ] T004 [P] [US1] Write test for AC-1 (scroll up → zoom increases, pivot fixed) `@covers AC-1` in `src/canvas/__tests__/zoom-pan.test.ts`
- [ ] T005 [P] [US1] Write test for AC-2 (scroll up at max zoom → stays at 8) `@covers AC-2` in `src/canvas/__tests__/zoom-pan.test.ts`
- [ ] T006 [P] [US1] Write test for AC-3 (scroll down at min zoom → stays at 0.1) `@covers AC-3` in `src/canvas/__tests__/zoom-pan.test.ts`
- [ ] T007 [P] [US1] Write test for AC-4 (scroll down → zoom decreases, pivot fixed) `@covers AC-4` in `src/canvas/__tests__/zoom-pan.test.ts`

### Implementation for User Story 1

- [ ] T008 [US1] Attach non-passive `wheel` event listener via `useEffect` to `svgRef.current`; inside handler call `e.preventDefault()` then compute `factor = e.deltaY < 0 ? 1.1 : 1/1.1` and call `zoomTo(camera.zoom * factor, pivot)` in `src/canvas/Whiteboard.tsx`

**Checkpoint**: Scroll to zoom works; AC-1 through AC-4 tests pass.

---

## Phase 4: User Story 2 — Hand Tool Pointer Pan (Priority: P1)

**Goal**: Drag with the Hand tool pans the canvas; shapes at any world coordinate become accessible.

**Independent Test**: Select the Hand tool, drag the canvas — viewport moves smoothly; release — pan stops.

### Tests for User Story 2

- [ ] T009 [P] [US2] Write test for AC-5 (hand tool drag → camera pans by -Δx/zoom, -Δy/zoom) `@covers AC-5` in `src/canvas/__tests__/zoom-pan.test.ts`
- [ ] T010 [P] [US2] Write test for AC-6 (pointer up → panning stops, camera committed) `@covers AC-6` in `src/canvas/__tests__/zoom-pan.test.ts`
- [ ] T011 [P] [US2] Write test for AC-7 (shapes at world coord `(50000, 50000)` reachable after pan — use ≥50k to align with SC-004) `@covers AC-7` in `src/canvas/__tests__/zoom-pan.test.ts`

### Implementation for User Story 2

- [ ] T012 [US2] In `handlePointerDown`: when `tool === 'hand'`, set `panStart.current`, call `setIsPanning(true)`, `setPointerCapture`, `preventDefault`, `stopPropagation`, and `return` in `src/canvas/Whiteboard.tsx`
- [ ] T013 [US2] In `handlePointerMove`: when `panStart.current !== null`, compute incremental `dx/dy`, call `panBy(-dx/camera.zoom, -dy/camera.zoom)`, update `panStart.current`, and `return` in `src/canvas/Whiteboard.tsx`
- [ ] T014 [US2] In `handlePointerUp` and `handlePointerLeave`: when `panStart.current !== null`, clear it and call `setIsPanning(false)` in `src/canvas/Whiteboard.tsx`. Note: pointer capture prevents `pointerleave` from firing during active pan — `pointerLeave` handler is a defensive fallback only.

**Checkpoint**: Hand tool drag pans canvas; AC-5, AC-6, AC-7 tests pass.

---

## Phase 5: User Story 3 — Middle Mouse Button Pan (Priority: P2)

**Goal**: Middle mouse button drag pans regardless of active tool; tool and selection state unchanged on release.

**Independent Test**: With Select tool active, middle-mouse-drag — canvas pans; release — tool stays Select and selection unchanged.

### Tests for User Story 3

- [ ] T015 [P] [US3] Write test for AC-8 (middle mouse drag → camera pans regardless of tool) `@covers AC-8` in `src/canvas/__tests__/zoom-pan.test.ts`
- [ ] T016 [P] [US3] Write test for AC-9 (middle mouse up → tool/selection unchanged) `@covers AC-9` in `src/canvas/__tests__/zoom-pan.test.ts`

### Implementation for User Story 3

- [ ] T017 [US3] Extend the pan-trigger check in `handlePointerDown` to also activate when `e.button === 1` (middle mouse), using the same panStart/isPanning/setPointerCapture path already wired for hand tool in `src/canvas/Whiteboard.tsx`

**Checkpoint**: Middle mouse pan works; AC-8 and AC-9 tests pass.

---

## Phase 6: User Story 4 — Space + Drag Temporary Pan (Priority: P3)

**Goal**: Holding Space while dragging temporarily pans (any tool); releasing Space restores the tool without drawing.

**Independent Test**: With Rectangle tool active, hold Space + drag — canvas pans, no rectangle drawn; release Space — Rectangle tool resumes.

### Tests for User Story 4

- [ ] T018 [P] [US4] Write test for AC-10 (Space held + drag → camera pans, no element created) `@covers AC-10` in `src/canvas/__tests__/zoom-pan.test.ts`
- [ ] T019 [P] [US4] Write test for AC-11 (Space released → original tool resumes, no shape drawn) `@covers AC-11` in `src/canvas/__tests__/zoom-pan.test.ts`
- [ ] T020 [P] [US4] Write test for AC-12 (Space in text input → character typed, no pan) `@covers AC-12` in `src/canvas/__tests__/zoom-pan.test.ts`

### Implementation for User Story 4

- [ ] T021 [US4] Add `useEffect` in `Whiteboard.tsx` that listens for `keydown`/`keyup` on `window`; on Space keydown call `e.preventDefault()` and `setSpaceDown(true)` (skip if focused element is INPUT/TEXTAREA/SELECT/contentEditable); on Space keyup call `setSpaceDown(false)` in `src/canvas/Whiteboard.tsx`
- [ ] T022 [US4] Extend pan-trigger check in `handlePointerDown` to also activate when `spaceDown === true` in `src/canvas/Whiteboard.tsx`

**Checkpoint**: Space+drag pans canvas; AC-10, AC-11, AC-12 tests pass.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T023 [P] Apply cursor style to `<svg>` element: `cursor: isPanning ? 'grabbing' : (tool==='hand'||spaceDown) ? 'grab' : undefined` in `src/canvas/Whiteboard.tsx`
- [ ] T024 Run `pnpm typecheck` and fix any TypeScript errors
- [ ] T025 Run `pnpm lint` and fix any lint errors
- [ ] T026 Run full test suite with `pnpm test` and confirm all AC tests pass
- [ ] T027 Run quickstart.md manual validation scenarios to confirm end-to-end behaviour

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Foundational)**: No dependencies — start immediately
- **Phase 3 (US1 Zoom)**: Depends on T001, T002, T003
- **Phase 4 (US2 Hand Pan)**: Depends on T001, T002, T003 — runs in parallel with Phase 3
- **Phase 5 (US3 Middle Mouse)**: Depends on Phase 4 (T012–T014 must exist); can start after
- **Phase 6 (US4 Space Pan)**: Depends on Phase 4 (pan plumbing exists); can start in parallel with Phase 5
- **Phase 7 (Polish)**: Depends on all user story phases complete

### User Story Dependencies

- **US1**: Independent after Foundational
- **US2**: Independent after Foundational (different handler paths from US1)
- **US3**: Builds on US2's pan plumbing (same handler, additional trigger)
- **US4**: Builds on US2's pan plumbing (same handler, additional trigger + useEffect)

### Parallel Opportunities

- T004–T007 (US1 tests): all parallel
- T009–T011 (US2 tests): all parallel
- T015–T016 (US3 tests): parallel
- T018–T020 (US4 tests): all parallel
- T023 (cursor polish): parallel with T024–T025 (different concerns)

---

## Implementation Strategy

### MVP First (User Story 1 + 2 — the core)

1. Complete Phase 2 (Foundational)
2. Complete Phase 3 (Scroll Zoom — AC-1 to AC-4)
3. Complete Phase 4 (Hand Tool Pan — AC-5 to AC-7)
4. **STOP and VALIDATE**: test manually per quickstart.md

### Incremental Delivery

- After Phase 4: basic zoom + hand pan work → demo-able
- After Phase 5: middle mouse users satisfied
- After Phase 6: power users (Space shortcut) satisfied
- After Phase 7: fully polished and lint-clean
