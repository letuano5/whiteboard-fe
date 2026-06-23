# Tasks: P1A-03 Move / Resize / Delete Shape

**Input**: Design documents from `specs/002-move-resize-delete/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, acceptance.md ✅

**Tests**: Explicit TDD — one test task per AC-n (AC-1..AC-12), tagged `@covers AC-n`.

**Organization**: Grouped by user story for independent testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no in-progress dependencies)
- **[Story]**: User story this task belongs to (US1=Move, US2=Resize, US3=Delete)

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Extend `interaction.store.ts` and `SvgLayer.tsx` so all three user stories can build on them.

**⚠️ CRITICAL**: Phases 2–4 cannot begin until this phase is complete.

- [ ] T001 Add `draggingId: string | null`, `dragStart: { x: number; y: number } | null`, and `resizeHandle: HandleId | null` fields + setters to `src/store/interaction.store.ts`
- [ ] T002 Add `onHandlePointerDown?: (handle: HandleId, e: React.PointerEvent) => void` prop to `SelectionOverlay` in `src/canvas/layers/SvgLayer.tsx`; add `onPointerDown` + `e.stopPropagation()` to each handle `<circle>` and pass the prop through `SvgLayer` → `Whiteboard.tsx`

**Checkpoint**: Interaction store has drag fields; handles fire pointer events up to Whiteboard.

---

## Phase 2: User Story 1 — Move Shape (Priority: P1) 🎯 MVP

**Goal**: Drag a selected shape body to reposition it; commit x/y via `patchElement` on pointer-up.

**Independent Test**: Select a shape, drag its body, release — shape appears at the new location and `elements.store` reflects updated x/y.

### Tests for User Story 1 (write first, verify they FAIL before implementation)

- [ ] T003 [P] [US1] Write test `@covers AC-1`: given selected element + pointerMove by (dx,dy), `interactionStore.draftElement.x === el.x + dx` and `.y === el.y + dy` (live preview, not committed store) — in `src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T004 [P] [US1] Write test `@covers AC-2`: given pointerUp after move, `patchElement` called with updated x/y and element version incremented — in `src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T005 [P] [US1] Write test `@covers AC-3`: given `selectedIds` empty, pointerDown on canvas → no drag state set — in `src/canvas/tools/__tests__/select-tool.test.ts`

### Implementation for User Story 1

- [ ] T006 [US1] Extend `onSelectPointerDown` in `src/canvas/tools/select-tool.ts`: if `selectedIds[0]` exists and pointer is on shape body (not a handle — `resizeHandle` is null), set `draggingId`, `dragStart`, call `e.currentTarget.setPointerCapture(e.pointerId)` on the SVG root element (passed via `svgEl: Element` parameter consistent with `create-shape-tool.ts` pattern); also export new `onSelectPointerMove` and `onSelectPointerUp` stubs
- [ ] T007 [US1] Implement `onSelectPointerMove` in `src/canvas/tools/select-tool.ts` for move: compute `(dx, dy) = worldPt - dragStart`; write `draftElement = { ...el, x: el.x + dx, y: el.y + dy }` to interaction store
- [ ] T008 [US1] Implement `onSelectPointerUp` in `src/canvas/tools/select-tool.ts` for move: call `patchElement(draggingId, { x, y })` with the draft coordinates; clear `draggingId`, `dragStart`, `draftElement`
- [ ] T009 [US1] Wire `onSelectPointerMove` + `onSelectPointerUp` into `Whiteboard.tsx` `handlePointerMove` / `handlePointerUp` for `tool === 'select'`

**Checkpoint**: Drag-move works end-to-end; AC-1, AC-2, AC-3 tests pass.

---

## Phase 3: User Story 2 — Resize Shape (Priority: P1)

**Goal**: Drag any of the 8 handles to resize a shape; clamp to 1×1; commit via `patchElement` on pointer-up.

**Independent Test**: Select a shape, drag `se` — width/height grow. Drag `nw` — all four sides move. Drag beyond minimum — shape clamps at 1×1.

### Tests for User Story 2 (write first, verify they FAIL before implementation)

- [ ] T010 [P] [US2] Write test `@covers AC-4`: drag `se` by (dx, dy) → width += dx, height += dy, x/y unchanged — in `src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T011 [P] [US2] Write test `@covers AC-5`: drag `nw` by (dx, dy) → x += dx, y += dy, width -= dx, height -= dy — in `src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T012 [P] [US2] Write test `@covers AC-6`: drag `n` by (0, dy) → y += dy, height -= dy, x/width unchanged — in `src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T013 [P] [US2] Write test `@covers AC-7`: resize drag that would reduce width/height < 1 → clamped to 1 — in `src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T014 [P] [US2] Write test `@covers AC-8`: pointerUp after resize → `patchElement` called with final dimensions, version incremented — in `src/canvas/tools/__tests__/select-tool.test.ts`

### Implementation for User Story 2

- [ ] T015 [US2] Add a new exported function `onSelectHandlePointerDown(handle: HandleId, worldPt: Point, svgEl: Element, e: React.PointerEvent): void` in `src/canvas/tools/select-tool.ts`; it sets `draggingId`, `dragStart`, `resizeHandle = handle`, and calls `svgEl.setPointerCapture(e.pointerId)` — separate from `onSelectPointerDown` to keep body-drag and handle-drag paths distinct
- [ ] T016 [US2] Add `computeResize(el, handle, worldPt, dragStart)` helper in `src/canvas/tools/select-tool.ts`: implement anchor-opposite geometry for all 8 handles (from research.md D4); clamp width/height to min 1
- [ ] T017 [US2] Extend `onSelectPointerMove` in `src/canvas/tools/select-tool.ts`: if `resizeHandle !== null`, call `computeResize` and write result to `draftElement`
- [ ] T018 [US2] Extend `onSelectPointerUp` in `src/canvas/tools/select-tool.ts`: if `resizeHandle !== null`, call `patchElement(draggingId, { x, y, width, height })` from `draftElement`; clear all drag state
- [ ] T019 [US2] Pass `onHandlePointerDown` from `Whiteboard.tsx` into `SvgLayer` → `SelectionOverlay` and call the select-tool resize-start from the Whiteboard handler

**Checkpoint**: All 8 handles resize correctly; minimum-size clamping holds; AC-4..AC-8 tests pass.

---

## Phase 4: User Story 3 — Delete Shape (Priority: P1)

**Goal**: Press Del/Backspace with a shape selected → soft delete via `deleteElements`; clear selection.

**Independent Test**: Select a shape, press Delete — shape disappears, `isDeleted = true` in store, `selectedIds = []`.

### Tests for User Story 3 (write first, verify they FAIL before implementation)

- [ ] T020 [P] [US3] Write test `@covers AC-9`: with selected shape, simulated Delete keydown → `deleteElements` called with the shape id and `isDeleted` becomes `true` — in `src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T021 [P] [US3] Write test `@covers AC-10`: soft-deleted element (`isDeleted = true`) is filtered out of SvgLayer visible list — in `src/canvas/layers/__tests__/SvgLayer.test.tsx`
- [ ] T022 [P] [US3] Write test `@covers AC-11`: after delete, `interactionStore.selectedIds` is empty — in `src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T023 [P] [US3] Write test `@covers AC-12`: no shape selected, Delete keydown → no state change, `deleteElements` not called — in `src/canvas/tools/__tests__/select-tool.test.ts`

### Implementation for User Story 3

- [ ] T024 [US3] Add `onSelectKeyDown(key: string): void` export in `src/canvas/tools/select-tool.ts`: if `key === 'Delete' || key === 'Backspace'` and `selectedIds.length > 0`, call `deleteElements(selectedIds)` then `setSelectedIds([])`; no-op otherwise
- [ ] T025 [US3] Add `useEffect` in `src/canvas/Whiteboard.tsx` that registers a `keydown` listener on `window`, calls `onSelectKeyDown(e.key)` only when `tool === 'select'`; returns cleanup `removeEventListener`

**Checkpoint**: Delete key removes shape; selection clears; AC-9..AC-12 tests pass.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T026 Run full test suite: `pnpm test` — all tests green including pre-existing ones
- [ ] T027 Run typecheck: `pnpm typecheck` — zero errors
- [ ] T028 Run linter: `pnpm lint` — zero warnings/errors
- [ ] T029 [P] Validate quickstart.md scenarios manually in the browser (move, resize se, resize nw, min-size clamp, delete, no-op delete)
- [x] T030 [US1] Fix point-based move so line `props.points` are translated and committed with the bounding box; add regression test for AC-13
- [x] T031 [US2] Fix point-based resize so line `props.points` are transformed and committed with the bounding box; add regression tests for AC-14 and horizontal-line resize

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies — start immediately
- **Phase 2 (US1 Move)**: Depends on Phase 1 ✅ → can start once T001, T002 done
- **Phase 3 (US2 Resize)**: Depends on Phase 1 ✅ + the select-tool stubs from T006; US2 tests (T010–T014) can run in parallel with US1 implementation
- **Phase 4 (US3 Delete)**: Independent of US1/US2 implementation; only needs T001 (store fields) + the exported function pattern from select-tool.ts
- **Phase 5 (Polish)**: All phases complete

### Within Each User Story

1. Write tests → verify they FAIL
2. Implement
3. Tests pass → Checkpoint

### Parallel Opportunities

- T003, T004, T005 (US1 tests) can be written in parallel
- T010–T014 (US2 tests) can all be written in parallel
- T020–T023 (US3 tests) can all be written in parallel
- T026, T027, T028, T029 can run in parallel

---

## Implementation Strategy

### MVP First

1. Phase 1 (T001, T002) — unlock drag infrastructure
2. Phase 2 (T003–T009) — Move: most-used action
3. **STOP & VALIDATE**: drag-move works

### Incremental Delivery

1. Foundation → Move → Resize → Delete
2. Each story validated by its AC tests before moving on

---

## Notes

- `draftElement` (already in interaction store) is reused for live preview during drag
- `patchElement` called once per drag gesture (on `pointerUp`), not per `pointerMove`
- `computeResize` helper in select-tool.ts keeps resize geometry testable without DOM
- AC-10 test lives in `SvgLayer.test.tsx` since it tests rendering behaviour, not select-tool logic
