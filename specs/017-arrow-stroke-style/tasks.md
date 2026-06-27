# Tasks: Arrow + Stroke Style (P2-09)

**Input**: Design documents from `specs/017-arrow-stroke-style/`

**Organization**: Tasks grouped by user story for independent implementation and testing.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: No shared-type changes needed. Arrow tool wired into create-shape-tool.ts first so the ShapeUtil render can use it.

- [ ] T001 Add `'arrow'` to `SHAPE_TOOLS` in `frontend/src/canvas/tools/create-shape-tool.ts`; add arrow branch in `buildDraftFromPoints` (same as `line`: `points: [[start.x, start.y], [current.x, current.y]]`); add arrow branch in `isValidSize` (`sqrt(dx²+dy²) >= 2`)

**Checkpoint**: Arrow tool selectable in code; no renderer yet (shape won't render).

---

## Phase 2: User Story 1 — Draw a Two-point Arrow (Priority: P1) 🎯 MVP

**Goal**: User can drag the Arrow tool to create an arrow with a filled arrowhead.

**Independent Test**: Select Arrow tool, drag from A to B → arrow line with filled arrowhead at B appears. Click-drag < 2px → nothing created. Select arrow → handles at tail and head. Drag handle → endpoint moves.

### Tests — Arrow Drawing (write first, must FAIL before implementation)

- [ ] T002 [P] [US1] Write test: `arrowShapeUtil.hitTest` returns true on the line segment and false off it (`@covers AC-1, AC-13`) in `frontend/src/canvas/shapes/__tests__/arrow.test.ts`
- [ ] T003 [P] [US1] Write test: `arrowShapeUtil.getBounds` returns bounding box of the two points (`@covers AC-1`) in `frontend/src/canvas/shapes/__tests__/arrow.test.ts`
- [ ] T004 [P] [US1] Write test: arrow creation with drag < 2px is rejected by `isValidSize` (`@covers AC-5`) in `frontend/src/canvas/tools/__tests__/create-shape-tool.test.ts`
- [ ] T005 [P] [US1] Write test: `arrowShapeUtil.render` produces a `<g>` containing a line and a polygon element (`@covers AC-2`) in `frontend/src/canvas/shapes/__tests__/arrow.test.ts`

### Implementation — Arrow ShapeUtil

- [ ] T006 [US1] Create `frontend/src/canvas/shapes/arrow.tsx` with `arrowShapeUtil`: `render` returns `<g>` with `<line>` body + `<polygon>` arrowhead (constants: `ARROW_HEAD_LEN=12`, `ARROW_HEAD_WIDTH=8`); `hitTest` uses point-to-line-segment distance ≤ `max(8, strokeWidth/2)`; `getBounds` returns bounding box of points; `resize` moves tail (`nw`/`w`/`sw`) or head (`ne`/`e`/`se`) endpoint
- [ ] T007 [US1] Register `arrowShapeUtil` in `frontend/src/canvas/shapes/index.ts`
- [ ] T008 [US1] Add Arrow button to `frontend/src/components/toolbar/Toolbar.tsx` using `ArrowRight` icon from `lucide-react`

**Checkpoint**: Arrow draws correctly; arrowhead points from tail to head. Tests T002–T005 pass.

---

## Phase 3: User Story 2 — Stroke Style: solid / dashed / dotted (Priority: P1)

**Goal**: All shapes have a stroke style selector in the detail panel.

**Independent Test**: Select any shape; detail panel shows Stroke style dropdown; change to dashed/dotted/solid — visual updates immediately. New shapes default to solid. Refresh page — style persists.

### Tests — Stroke Style

- [ ] T009 [P] [US2] Write test: `strokeDashArray('dashed')` returns a non-empty string; `strokeDashArray('dotted')` returns a non-empty string; `strokeDashArray('solid')` returns undefined (`@covers AC-6, AC-7, AC-8`) in `frontend/src/canvas/shapes/__tests__/arrow.test.ts` (or a shared utils test)
- [ ] T010 [P] [US2] Write test: new element from `createElement` has `strokeStyle: 'solid'` by default (`@covers AC-9`) in `frontend/src/store/__tests__/mutation-pipeline.test.ts`

### Implementation — Stroke Style UI

- [ ] T011 [US2] Add Stroke style `<select>` control (options: solid/dashed/dotted) to `frontend/src/components/detail-panel/DetailPanel.tsx` after the Stroke width field; show for all element types; apply `patch({ strokeStyle: value })` on change
- [ ] T012 [US2] Ensure `DEFAULT_PROPS` in `frontend/src/canvas/tools/create-shape-tool.ts` includes `strokeStyle: 'solid'` (verify it already does; if not, add it)

### Persistence Test

- [ ] T013 [US2] Write test: element with `strokeStyle: 'dashed'` round-trips through localStorage serialization unchanged (`@covers AC-10`) in `frontend/src/sync/__tests__/local-storage.test.ts` (or existing test file)

**Checkpoint**: Stroke style control visible and functional. Dashed/dotted render correctly. Tests T009–T010, T013 pass.

---

## Phase 4: User Story 3 — Arrow Common Operations (Priority: P2)

**Goal**: Arrow participates in select, move, style change, delete, multi-select (P2-08).

**Independent Test**: Draw arrow; select via click → handles shown. Drag body → moves. Change stroke color → updates. Delete → removed. Marquee covering arrow → arrow in selection.

### Tests — Arrow Operations

- [ ] T014 [P] [US3] Write test: `arrowShapeUtil.hitTest` is true when clicking near arrow body (`@covers AC-13`) in `frontend/src/canvas/shapes/__tests__/arrow.test.ts`
- [ ] T015 [P] [US3] Write test: `arrowShapeUtil.render` uses `props.strokeColor` for both line and polygon fill (`@covers AC-15`) in `frontend/src/canvas/shapes/__tests__/arrow.test.ts`
- [ ] T016 [P] [US3] Write test: arrow's bounding box is included in marquee intersection check (`@covers AC-16`) in `frontend/src/canvas/shapes/__tests__/arrow.test.ts`

### Implementation — Arrow Operations

*(Arrow operations work via the ShapeUtil registry + existing select-tool + mutation pipeline — no new implementation required if T006 and T007 are complete. Verify below items.)*

- [ ] T017 [US3] Verify that the arrow's `getBounds` result is used correctly by the marquee hit-test in `frontend/src/canvas/tools/select-tool.ts` — update the marquee intersection logic to call `getShapeUtil(el.type)?.getBounds(el)` instead of using raw `x,y,width,height` if not already doing so

**Checkpoint**: Arrow fully integrated into all common operations. Tests T014–T016 pass.

---

## Phase 5: Polish & Cross-Cutting

- [ ] T018 [P] Run `pnpm typecheck` from repo root; fix any TypeScript errors
- [ ] T019 [P] Run `pnpm lint` from repo root; fix any lint errors
- [ ] T020 Run `pnpm test` from repo root; confirm all T002–T016 pass
- [ ] T021 Validate manually against quickstart.md scenarios S1–S9

---

## Dependencies & Execution Order

- **Phase 1 (Foundational)**: No dependencies — start immediately.
- **Phase 2 (Arrow ShapeUtil)**: Depends on Phase 1.
- **Phase 3 (Stroke Style UI)**: Can start in parallel with Phase 2 after Phase 1.
- **Phase 4 (Arrow Operations)**: Depends on Phase 2 (needs ShapeUtil registered).
- **Phase 5 (Polish)**: Depends on Phases 2–4.

---

## Implementation Strategy

### MVP (Phases 1 + 2)

1. Phase 1 → wire arrow to create-shape-tool.
2. Phase 2 → implement ShapeUtil + register + add toolbar button.
3. **STOP and VALIDATE**: Arrow draws, has arrowhead, can be selected and deleted.

### Incremental Delivery

1. Phase 1 → arrow tool plumbing.
2. Phase 2 → arrow rendering (MVP complete).
3. Phase 3 → stroke style UI (adds value to all shapes).
4. Phase 4 → verify arrow operations (minimal work if ShapeUtil is correct).
5. Phase 5 → polish.
