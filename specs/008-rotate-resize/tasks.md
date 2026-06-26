# Tasks: Rotate + Resize for Rotated Shapes (P1B-01)

**Input**: Design documents from `specs/008-rotate-resize/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅

**Organization**: Grouped by user story (US1: Rotate, US2: Hit-test, US3: Resize). Tests come before implementation per TDD.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1 = Rotate, US2 = Hit-test, US3 = Resize)
- Exact file paths in every description

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: New geometry util + state additions that ALL user stories depend on.

**⚠️ CRITICAL**: All user story work blocks on this phase.

- [ ] T001 Create new `src/utils/geometry.ts` with `rotatePoint(pt, center, angle)` and `unrotatePoint(pt, center, angle)` using the 2D rotation matrix in `data-model.md` (note: `src/types/geometry.ts` has the `Point` type — import from there)
- [ ] T002 [P] Add `isRotating: boolean` field to `InteractionState` interface in `src/types/interaction.ts` (default `false`)
- [ ] T003 [P] Add `isRotating: false` to `DEFAULT_STATE` and `setIsRotating: (v: boolean) => void` action in `src/store/interaction.store.ts`

**Checkpoint**: Geometry util and state additions are in place — user story implementation can begin.

---

## Phase 2: TDD Tests — Write ALL Tests First (FAIL before implementation)

**Purpose**: One test per AC-n derived from `acceptance.md`. All tests must be written and confirmed RED before any implementation task in Phases 3–5.

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

### Tests for US1 — Rotate Interaction (AC-1, AC-2, AC-3, AC-4)

- [ ] T004 [P] [US1] Write `src/utils/geometry.test.ts`: test `rotatePoint` — rotating `(1,0)` around origin by `π/2` returns approx `(0,1)` (@covers AC-3); also add `unrotatePoint` identity test — `unrotatePoint(pt, center, 0)` returns `pt` unchanged (@covers AC-12)
- [ ] T005 [P] [US1] Write `src/canvas/tools/__tests__/rotate-tool.test.ts`: test `onRotateHandlePointerDown` sets `isRotating=true`, `draggingId`, and `dragStart` on the selected element (@covers AC-1)
- [ ] T006 [P] [US1] In `rotate-tool.test.ts`: test `onSelectPointerMove` with `isRotating=true` — dragging pointer 90° clockwise from center-top produces `draftElement.angle ≈ π/2` (@covers AC-2, AC-3)
- [ ] T007 [P] [US1] In `rotate-tool.test.ts`: test `onSelectPointerUp` with `isRotating=true` — calls `patchElement` with the draft angle and clears `isRotating` (@covers AC-2)
- [ ] T008 [P] [US1] In `rotate-tool.test.ts`: test that `patchElement` is called (not store directly) for rotate commit — verifies pipeline routing (@covers AC-4)

### Tests for US2 — Hit-Test for Rotated Shapes (AC-5, AC-6, AC-7)

- [ ] T009 [P] [US2] Write `src/canvas/tools/__tests__/select-tool-rotated.test.ts`: test `onSelectPointerDown` with a 45°-rotated rectangle — clicking inside the rotated body selects it (@covers AC-5)
- [ ] T010 [P] [US2] In `select-tool-rotated.test.ts`: test `onSelectPointerDown` — clicking inside the original axis-aligned bbox but clearly outside the rotated body does NOT select the shape (@covers AC-6)
- [ ] T011 [P] [US2] In `select-tool-rotated.test.ts`: test `onSelectPointerDown` with two overlapping rotated shapes — the higher `zIndex` shape is selected (@covers AC-7)

### Tests for US3 — Resize Rotated Shapes (AC-8, AC-9, AC-10, AC-11)

- [ ] T012 [P] [US3] In `select-tool-rotated.test.ts`: test `onSelectPointerMove` during resize of a 30°-rotated rectangle — pointer un-rotated to local space; resulting draft has wider/taller bbox while angle unchanged (@covers AC-8, AC-9)
- [ ] T013 [P] [US3] In `select-tool-rotated.test.ts`: test `onSelectPointerUp` after resize of rotated shape — `patchElement` is called with new `x,y,width,height` and unchanged `angle` (@covers AC-9)
- [ ] T014 [P] [US3] In `select-tool-rotated.test.ts`: test resize flip — dragging a handle past the opposite edge produces positive `width`/`height` and the active handle flips (@covers AC-10)
- [ ] T015 [P] [US3] In `select-tool-rotated.test.ts`: test `resizePointGeometry` via a line element — after resize, `props.points` are scaled and mirrored to match the new bbox (@covers AC-11) (polygon/freehand out of scope for P1B-01)

### Tests for Regression and Persistence (AC-12, AC-13)

- [ ] T016 [P] In `select-tool-rotated.test.ts`: confirm hit-test for an `angle=0` shape matches existing AABB behavior exactly — `unrotatePoint` with `angle=0` is identity, so hit-test result must be identical to P1A (@covers AC-12)
- [ ] T018 [P] In existing `src/sync/__tests__/local-storage.test.ts`: add test — saving an element with `angle ≠ 0` and reloading restores the same angle value (@covers AC-13)

**Checkpoint**: 15 tests written, all RED. Proceed to implementation phases.

---

## Phase 3: User Story 1 — Rotate a Shape (Priority: P1) 🎯 MVP

**Goal**: User can drag the rotate handle on a selected shape; angle is updated in real time and committed via `patchElement`.

**Independent Test**: Select any shape, drag the rotate handle clockwise, release — shape renders at the new angle and re-selection shows the handle at the rotated position.

### Implementation for US1

- [ ] T019 [US1] Add rotate interaction functions to `src/canvas/tools/select-tool.ts`: `onRotateHandlePointerDown(worldPt)` — sets `draggingId`, `dragStart`, `isRotating=true`
- [ ] T020 [US1] In `src/canvas/tools/select-tool.ts` `onSelectPointerMove`: add rotate branch (checked before resize) — computes `angle = atan2(dy, dx) + π/2`, normalizes to `[-π, π]`, sets `draftElement.angle`
- [ ] T021 [US1] In `src/canvas/tools/select-tool.ts` `onSelectPointerUp`: add rotate commit branch — calls `patchElement(draggingId, { angle: draftElement.angle })`, then `setIsRotating(false)`
- [ ] T022 [US1] Update `src/canvas/layers/SvgLayer.tsx` `SelectionOverlay`: apply `rotate(angle, cx, cy)` transform to the outer `<g>`; add rotate handle circle at `(cx, y - 24)` and connector line; change `onHandlePointerDown` prop type to `HandleId` (already defined in `src/types/interaction.ts` — just update the import and the prop signature)
- [ ] T023 [US1] Update `src/canvas/Whiteboard.tsx` `handleHandlePointerDown`: change parameter type from `ResizeHandleId` to `HandleId` (update import); route `handle === 'rotate'` to `onRotateHandlePointerDown`; add `svgEl.setPointerCapture` for rotate drag; import `onRotateHandlePointerDown` from `select-tool`
- [ ] T024 [US1] Fix line shape rotation rendering in `src/canvas/shapes/line.tsx`: wrap `<polyline>`/`<line>` in `<g transform={angle !== 0 ? \`rotate(${angle*180/Math.PI} ${cx} ${cy})\` : undefined}>` — matches pattern already used by rectangle, ellipse, text, diamond

**Checkpoint**: US1 complete — all AC-1…AC-4 tests GREEN. Any shape can be rotated via the handle.

---

## Phase 4: User Story 2 — Hit-Test for Rotated Shapes (Priority: P1)

**Goal**: Clicking inside the visible rotated body selects the shape; clicking in the empty axis-aligned area does not.

**Independent Test**: Rotate a rectangle 45°, click on its visible corner → selected; click in the empty original-bbox corner → not selected.

### Implementation for US2

- [ ] T025 [US2] In `src/canvas/tools/select-tool.ts` `onSelectPointerDown`: import `unrotatePoint` from `../../utils/geometry`; before calling `util.hitTest`, compute `localPt = el.angle !== 0 ? unrotatePoint(worldPt, {x: cx, y: cy}, el.angle) : worldPt`; pass `localPt` to `hitTest`

**Checkpoint**: US2 complete — AC-5, AC-6, AC-7 tests GREEN. Hit-test works for all rotated shapes.

---

## Phase 5: User Story 3 — Resize a Rotated Shape (Priority: P2)

**Goal**: Resize handles work correctly for rotated shapes — resize operates in the element's local coordinate frame; opposite corner stays anchored.

**Independent Test**: Rotate a rectangle 30°, drag its bottom-right handle — shape grows while staying at 30°; opposite corner (top-left) remains stationary.

### Implementation for US3

- [ ] T026 [US3] In `src/canvas/tools/select-tool.ts` `onSelectPointerMove` resize branch: import `unrotatePoint`; when `el.angle !== 0`, un-rotate `worldPt` around the original bounds center (`resizeSession.originalBounds.x + w/2, .y + h/2`) before calling `resizeBoundsFromAnchorAndPointer`

**Checkpoint**: US3 complete — AC-8, AC-9, AC-10, AC-11 tests GREEN. Resize works for rotated shapes.

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Regression guard, geometry util tests, cleanup.

- [ ] T027 [P] Run `pnpm typecheck` — fix any TypeScript errors from `HandleId` widening and `isRotating` additions
- [ ] T028 [P] Run `pnpm lint:fix` — auto-fix any lint issues in modified files
- [ ] T029 Run `pnpm test` — confirm all 15+ AC-tagged tests GREEN; confirm no P1A regression in existing test suites
- [ ] T030 Run quickstart.md Scenario 4 (regression check) manually — shapes with `angle=0` behave identically to Phase 1A

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies — start immediately; T002 and T003 are parallel
- **Phase 2 (Tests)**: Depends on Phase 1 (T001–T003) — all T004–T018 can run in parallel with each other
- **Phase 3 (US1)**: Depends on Phase 1 + Phase 2 tests written; T019–T024 must run sequentially (same files)
- **Phase 4 (US2)**: Depends on Phase 1 + Phase 2; can start after Phase 1 independently of Phase 3
- **Phase 5 (US3)**: Depends on Phase 1 + Phase 2; can start after Phase 1 independently of Phase 3–4
- **Phase 6 (Polish)**: Depends on Phases 3–5 complete

### Within Each Story

- Tests MUST be written and RED before implementation
- T019 → T020 → T021 sequential (same file, logical order)
- T022 and T023 can run in parallel (different files)
- T024 is independent of T022/T023

### Parallel Opportunities

- Phase 1: T002 ∥ T003
- Phase 2: T004–T018 all parallel (different test files or different describes)
- Phase 3 vs Phase 4 vs Phase 5: can be tackled in parallel if the test infrastructure (Phase 2) is in place

---

## Implementation Strategy

### MVP (US1 only — Phases 1–3)

1. Phase 1: Foundation (T001–T003)
2. Phase 2: Write tests T004–T008 (rotate tests) — confirm RED
3. Phase 3: Implement US1 (T019–T024)
4. **VALIDATE**: `pnpm test` — AC-1…AC-4 GREEN

### Incremental Delivery

1. Foundation + US1 (rotate) → test GREEN → working rotate interaction
2. US2 (hit-test) → AC-5…AC-7 GREEN → correct click selection
3. US3 (resize) → AC-8…AC-11 GREEN → correct resize for rotated shapes
4. AC-12 (regression) GREEN throughout — no P1A breakage
5. AC-13 (persistence) GREEN — angle survives reload

---

## Notes

- [P] tasks = different files, no cross-dependencies
- [US1]/[US2]/[US3] maps to spec.md user stories
- Every `@covers AC-n` tag in a test must match an entry in `specs/008-rotate-resize/acceptance.md`
- `patchElement` is the ONLY way to commit rotate/resize — never write to `elements.store` directly
- `isRotating` and `resizeSession !== null` are mutually exclusive invariants
- The `HandleId` type widening (adding `'rotate'` to the prop) is backward-compatible — resize handles still use `ResizeHandleId`
