# Tasks: P1A-02 Select Shape (angle = 0)

**Input**: Design documents from `specs/001-select-shape/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, acceptance.md ✅

**Tests**: Included — TDD approach, one test per AC-n. Write tests FIRST, verify they FAIL, then implement.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US1]**: Click-to-select story | **[US2]**: Deselect story
- Exact file paths included in every description

---

## Phase 1: Setup

**Purpose**: No new packages or config needed. The ShapeUtil interface already declares `hitTest`. This phase is a no-op.

*(Skipped — no setup tasks required for this feature)*

---

## Phase 2: Foundational (hitTest in ShapeUtils — blocks both stories)

**Purpose**: All 5 ShapeUtils need working `hitTest` implementations before either user story's select-tool can be verified. These tasks are independent of each other and can run in parallel.

**⚠️ CRITICAL**: Must be complete before Phase 3 select-tool work begins.

- [ ] T001 [P] Implement AABB `hitTest` in `src/canvas/shapes/rectangle.tsx` — return `px >= x && px <= x+w && py >= y && py <= y+h`
- [ ] T002 [P] Implement AABB `hitTest` in `src/canvas/shapes/ellipse.tsx` — same AABB formula (angle=0 simplification)
- [ ] T003 [P] Implement AABB `hitTest` in `src/canvas/shapes/text.tsx` — same AABB formula
- [ ] T004 [P] Implement AABB `hitTest` in `src/canvas/shapes/diamond.tsx` — same AABB formula (use bbox, not diamond vertices)
- [ ] T005 [P] Implement point-to-segment `hitTest` in `src/canvas/shapes/line.tsx` — distance from world point to segment `[points[0], points[1]]` ≤ 8 world units; fallback to AABB if `props.points` is missing

**Checkpoint**: All 5 `hitTest` methods return correct booleans — verified by unit tests in Phase 3.

---

## Phase 3: User Story 1 — Click to Select (Priority: P1) 🎯 MVP

**Goal**: Clicking a shape selects it; bounding box + 8 handles appear; z-order priority when overlapping.

**Independent Test**: Draw two overlapping rectangles, switch to select tool, click the overlap area → higher-zIndex shape becomes selected with visible bounding box and 8 handles.

### Tests for User Story 1 ⚠️ Write FIRST — verify they FAIL before T010–T012

- [ ] T006 [P] [US1] Write test `@covers AC-1` in `src/canvas/tools/__tests__/select-tool.test.ts`: call `onSelectPointerDown` with a world point inside a shape's bbox → assert `useInteractionStore.getState().selectedIds` contains that shape's ID
- [ ] T007 [P] [US1] Write test `@covers AC-2` in `src/canvas/tools/__tests__/select-tool.test.ts`: two overlapping shapes with zIndex 1 and 2; click at overlapping point → assert selectedIds contains only the zIndex-2 shape's ID
- [ ] T008 [P] [US1] Write test `@covers AC-3` in `src/canvas/tools/__tests__/select-tool.test.ts`: shape A selected; call `onSelectPointerDown` with point inside shape B → assert selectedIds = [B.id] only
- [ ] T009 [P] [US1] Write test `@covers AC-7` in `src/canvas/layers/__tests__/SvgLayer.test.tsx`: render `SvgLayer` with one shape selected → assert 8 `<circle>` elements present in the selection overlay (positions: nw, ne, sw, se, n, s, e, w)

### Implementation for User Story 1

- [ ] T010 [US1] Create `src/canvas/tools/select-tool.ts`: export `onSelectPointerDown(worldPt: Point): void` — get all non-deleted elements from `useElementsStore`, sort by `zIndex` descending, call `hitTest` on each, call `useInteractionStore.getState().setSelectedIds([firstHit.id])` on hit or `setSelectedIds([])` on miss
- [ ] T011 [US1] Add `SelectionOverlay` component inside `SvgLayer.tsx` camera-transform `<g>` group (after all shape nodes): renders a `<rect>` with `stroke-dasharray="4 2"` for the bbox + 8 `<circle r="4">` handles at nw/ne/sw/se/n/s/e/w positions — only rendered when `selectedIds.length > 0` and the selected element exists
- [ ] T012 [US1] Wire select tool in `src/canvas/Whiteboard.tsx`: add `tool === 'select'` branch in `handlePointerDown` to call `onSelectPointerDown(screenToWorld(...))` — no pointer capture needed (single-click only in P1A-02)

**Checkpoint**: Click any shape → bounding box with 8 handles appears; click the overlapping area of two shapes → the topmost one (highest zIndex) is selected. T006–T009 pass.

---

## Phase 4: User Story 2 — Deselect by Clicking Empty (Priority: P2)

**Goal**: Clicking empty canvas clears selection; clicking empty when nothing is selected causes no error.

**Independent Test**: Select a shape, then click an empty canvas area → bounding box disappears, `selectedIds` is empty.

### Tests for User Story 2 ⚠️ Write FIRST — verify they FAIL before T015–T016

- [ ] T013 [P] [US2] Write test `@covers AC-4` in `src/canvas/tools/__tests__/select-tool.test.ts`: shape A in selectedIds; call `onSelectPointerDown` with a point that hits no shape → assert selectedIds becomes `[]`
- [ ] T014 [P] [US2] Write test `@covers AC-5` in `src/canvas/tools/__tests__/select-tool.test.ts`: selectedIds is already `[]`; call `onSelectPointerDown` with a miss-point → assert selectedIds stays `[]` and no error thrown

### Implementation for User Story 2

*(Already covered by T010's miss-branch: `setSelectedIds([])` when no shape hit. No new code needed — verify T013–T014 pass after T010 is implemented.)*

- [ ] T015 [US2] Verify `onSelectPointerDown` miss-path in `src/canvas/tools/select-tool.ts` calls `setSelectedIds([])` — confirm T013 and T014 pass with no additional changes needed

**Checkpoint**: Click empty canvas → `selectedIds` = []; no console errors. T013–T014 pass.

---

## Phase 5: Cross-Cutting Acceptance Tests (AC-6, type-safety, edge cases)

**Purpose**: AC-6 (isolation of selection state) + robustness edge cases

- [ ] T016 [P] Write test `@covers AC-6` in `src/canvas/tools/__tests__/select-tool.test.ts`: call `onSelectPointerDown` → assert `useElementsStore.getState().elements` is unchanged; assert `localStorage` does not contain selectedIds (spy on `localStorage.setItem`)
- [ ] T017 [P] Write edge-case test in `src/canvas/shapes/__tests__/shapes.test.tsx`: `hitTest` called with zero-size shape (width=0, height=0) → must return `false` and not throw
- [ ] T018 [P] Write edge-case test: `onSelectPointerDown` with empty elements store → returns without error, selectedIds stays `[]`
- [ ] T019 [P] Write hitTest unit tests in `src/canvas/shapes/__tests__/shapes.test.tsx` for all 5 shape types: point inside bbox → true; point outside bbox → false; for line: point within 8 world units of segment → true, point >8 units → false

---

## Phase 6: Polish & Typecheck

- [ ] T020 Run `pnpm typecheck` — fix any TypeScript errors
- [ ] T021 Run `pnpm lint` — fix any lint errors  
- [ ] T022 Run `pnpm test` — all tests must be green

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (hitTest)**: No dependencies — start immediately; T001–T005 are all parallel
- **Phase 3 Tests (T006–T009)**: Depend only on Phase 2 completion (need `hitTest` defined to write against)
- **Phase 3 Impl (T010–T012)**: T010 first → T011 and T012 can be parallel after T010
- **Phase 4 Tests (T013–T014)**: Write alongside Phase 3 tests (miss-path is defined in the same `onSelectPointerDown`)
- **Phase 4 Verify (T015)**: After T010 is implemented
- **Phase 5**: After Phase 3 + Phase 4 impl complete
- **Phase 6**: Last

### Parallel Opportunities

All T001–T005 run in parallel (separate files). T006–T009 run in parallel. T013–T014 run in parallel with T006–T009. T016–T019 run in parallel.

---

## Implementation Strategy

### MVP (User Story 1 only, minimal UI)

1. Complete T001–T005 (hitTest in all shapes)
2. Write T006–T009 (tests — verify they FAIL)
3. Implement T010 (select-tool.ts)
4. Implement T011 (SelectionOverlay in SvgLayer)
5. Implement T012 (wire in Whiteboard)
6. **Validate**: T006–T009 pass; manual test in browser

### Full Delivery

Add Phase 4 (T013–T015) → Phase 5 (T016–T019) → Phase 6 typecheck+lint+test

---

## Notes

- `[P]` = different files, safe to parallelize
- TDD: every test must FAIL before its implementation task runs
- `hitTest` at angle=0 → AABB for all shapes except line (segment distance)
- Selection overlay: pure visual in P1A-02 (handles not yet interactive — resize is P1A-03)
- `selectedIds` NEVER touches `elementsStore` or `localStorage` (AC-6)
