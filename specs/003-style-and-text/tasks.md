# Tasks: Basic Style Panel & Text Properties (P1A-04 + P1A-05)

**Input**: Design documents from `specs/003-style-and-text/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, acceptance.md ✅

**Tests**: Included — one test task per AC-n in acceptance.md, derived from spec acceptance scenarios.

---

## Phase 1: Foundational (Blocking Prerequisite)

**Purpose**: Fix the existing text ShapeUtil bug so that textAlign actually aligns text within its bounding box. This is a prerequisite for all text-alignment tests in Phase 4.

**⚠️ CRITICAL**: Must complete before US2 text tests can be written meaningfully.

- [ ] T001 Fix text x-anchor in `src/canvas/shapes/text.tsx`: compute SVG `x` as `element.x` (left), `element.x + width/2` (center), or `element.x + width` (right) based on `props.textAlign`, so `textAnchor` aligns text correctly within the bounding box

**Checkpoint**: `text.tsx` renders left/center/right text at the correct anchor point within its bounding box.

---

## Phase 2: User Story 1 — Edit Shape Style (Priority: P1) 🎯 MVP

**Goal**: User selects a shape and edits strokeColor, fillColor, strokeWidth, opacity in a side panel — changes appear immediately.

**Independent Test**: Draw a rectangle, select it, change stroke color in the panel → rectangle outline changes immediately; deselect → panel disappears.

### Tests for User Story 1

> Write these tests FIRST. They MUST fail before T007 is implemented.

- [ ] T002 [P] [US1] Test: panel renders when one shape selected — `src/components/detail-panel/__tests__/DetailPanel.test.tsx` — `@covers AC-1`
- [ ] T003 [P] [US1] Test: panel returns null when no shape selected — same file — `@covers AC-2`
- [ ] T004 [P] [US1] Test: changing stroke color calls `patchElement` with new `strokeColor` — same file — `@covers AC-3`
- [ ] T005 [P] [US1] Test: changing fill color calls `patchElement` with new `fillColor` — same file — `@covers AC-4`
- [ ] T006 [P] [US1] Test: changing stroke width calls `patchElement` with new `strokeWidth` — same file — `@covers AC-5`
- [ ] T007 [P] [US1] Test: changing opacity slider calls `patchElement` with `opacity` in [0,1] — same file — `@covers AC-6`
- [ ] T008 [P] [US1] Test: patchElement is called (not direct store write) — verify via spy — same file — `@covers AC-7`
- [ ] T009 [P] [US1] Test: fill color control is hidden when a `line` element is selected — same file — `@covers AC-4` (line exception per FR-004)
- [ ] T009b [P] [US1] Test: style values shown in panel match element props after re-select — same file — `@covers AC-8`

### Implementation for User Story 1

- [ ] T010 [US1] Build `src/components/detail-panel/DetailPanel.tsx`: component reads `selectedIds[0]` from `useInteractionStore` and element from `useElementsStore`; returns null when `selectedIds.length !== 1` or element not found; renders style section with strokeColor, fillColor (hidden for `line`), strokeWidth, opacity controls; each `onChange` calls `patchElement(id, { props: { ...props, changed } })`
- [ ] T011 [US1] Wire `DetailPanel` into `src/canvas/Whiteboard.tsx`: import and render `<DetailPanel />` inside the root `<div>` alongside `SvgLayer` and `Toolbar`

**Checkpoint**: User Story 1 fully functional — select any shape, edit all 4 style properties, panel hides on deselect.

---

## Phase 3: User Story 2 — Edit Text Properties (Priority: P2)

**Goal**: When a text element is selected, panel additionally shows fontSize, fontFamily, textAlign controls; changes render immediately.

**Independent Test**: Create text "Hello", select it, change font size to 32 → text enlarges; change to serif → font changes; click Center → text centers in bounding box.

### Tests for User Story 2

> Write these tests FIRST. They MUST fail before T016 is implemented.

- [ ] T012 [P] [US2] Test: text controls (fontSize, fontFamily, textAlign) visible when text element selected — `src/components/detail-panel/__tests__/DetailPanel.test.tsx` — `@covers AC-9`
- [ ] T013 [P] [US2] Test: text controls NOT visible when rectangle selected — same file — `@covers AC-10`
- [ ] T014 [P] [US2] Test: changing fontSize calls `patchElement` with new `fontSize` — same file — `@covers AC-11`
- [ ] T015 [P] [US2] Test: changing fontFamily calls `patchElement` with new `fontFamily` — same file — `@covers AC-12`
- [ ] T016 [P] [US2] Test: text x-anchor for left alignment renders at `element.x` with `textAnchor='start'` — `src/canvas/shapes/__tests__/shapes.test.tsx` — `@covers AC-13`
- [ ] T017 [P] [US2] Test: text x-anchor for center alignment renders at `element.x + width/2` with `textAnchor='middle'` — same file — `@covers AC-14`
- [ ] T018 [P] [US2] Test: text x-anchor for right alignment renders at `element.x + width` with `textAnchor='end'` — same file — `@covers AC-15`
- [ ] T019 [P] [US2] Test: textAlign change calls `patchElement` with new `textAlign` — `src/components/detail-panel/__tests__/DetailPanel.test.tsx` — `@covers AC-16`

### Implementation for User Story 2

- [ ] T020 [US2] Add text-specific section to `DetailPanel` in `src/components/detail-panel/DetailPanel.tsx`: when `element.type === 'text'`, render fontSize (number input, min=1), fontFamily (`<select>` with sans-serif/serif/monospace options), and textAlign (3 toggle buttons L/C/R); each change calls `patchElement(id, { props: { ...props, changed } })`

**Checkpoint**: User Stories 1 AND 2 both functional — text elements show all 7 editable controls.

---

## Phase 4: User Story 3 — Style Changes Persist (Priority: P3)

**Goal**: Changes made via the panel survive deselection — re-selecting the same element shows the updated values.

**Independent Test**: Change a shape's fill to red, deselect, re-select → fill is still red, panel shows `#ff0000`.

*Note*: Persistence is automatic via Zustand committed store + `patchElement`. No new implementation needed. Phase 4 is tests-only.

### Tests for User Story 3

- [ ] T021 [P] [US3] Test: strokeColor persists — change color, deselect (clear selectedIds), re-select, panel input shows updated color — `src/components/detail-panel/__tests__/DetailPanel.test.tsx` — `@covers AC-8` (persistence scenario)
- [ ] T022 [P] [US3] Test: fontSize persists — change fontSize on text element, deselect, re-select, panel shows updated fontSize — same file — `@covers AC-8` (text persistence scenario)

**Checkpoint**: All three user stories complete and independently testable.

---

## Phase 6: Bug Fixes (post-implementation)

**Purpose**: Fix three behavior bugs found during P1A-04/05 manual testing.

- [x] T027 Fix keydown guard in `src/canvas/Whiteboard.tsx`: in `handleKeyDown` effect, check `e.target.tagName` (INPUT/TEXTAREA/SELECT) and `isContentEditable` before calling `onSelectKeyDown` — `@covers AC-17`
- [x] T028 Guard SVG pointer events in `src/canvas/Whiteboard.tsx`: in `handlePointerDown`, early-return when `!(e.target instanceof SVGElement)` to prevent spurious deselection from non-SVG events — `@covers AC-18`
- [x] T029 Prevent event leakage from panel in `src/components/detail-panel/DetailPanel.tsx`: add `onPointerDown={(e) => e.stopPropagation()}` to the root div — `@covers AC-18`
- [x] T030 Fix text click-to-create in `src/canvas/tools/create-shape-tool.ts`: in `onShapePointerUp`, add else-if branch for `type === 'text'` that creates a 200×40 element at `dragStart` when `isValidSize` returns false — `@covers AC-19`
- [x] T031 [P] Test: text click-to-create — `src/canvas/tools/__tests__/create-shape-tool.test.ts` — verify `createElement` called with `width=200, height=40` when pointerUp at same/near point as start — `@covers AC-19`

**Checkpoint**: All three bugs resolved; all tests pass.

---

## Phase 5: Polish & Verification

- [ ] T023 Run `pnpm typecheck` and fix any TypeScript errors in new/modified files
- [ ] T024 Run `pnpm lint` and fix any ESLint errors in new/modified files
- [ ] T025 Run `pnpm test` — all tests must pass (0 failures)
- [ ] T026 Run `scripts/check-ac-coverage.sh` — every AC-1 through AC-16 must have a `@covers` tag

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies — start immediately
- **Phase 2 (US1)**: Depends on Phase 1 (T001) only for text tests; style implementation (T010, T011) can start in parallel with T001
- **Phase 3 (US2)**: Depends on Phase 2 completion (DetailPanel must exist before adding text section)
- **Phase 4 (US3)**: Depends on Phase 2 + Phase 3 completion
- **Phase 5 (Polish)**: Depends on all previous phases

### Within Each Phase

- Write tests FIRST (T002–T009, T012–T019, T021–T022) — all marked [P] can be written together
- Implementation tasks (T010–T011, T020) come after tests are written and failing
- T011 (Whiteboard wiring) can happen after T010 is complete

### Parallel Opportunities

- T001 + T002–T009: Can run in parallel (different files)
- T002 through T009: All test stubs can be written together (same file, different test cases)
- T012 through T019: Same — all test stubs in parallel
- T021, T022: Parallel with each other

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 (text fix) + T002–T009 (write failing tests) — parallel
2. T010 (build DetailPanel with style controls)
3. T011 (wire into Whiteboard)
4. Verify T002–T009 now pass
5. **STOP and VALIDATE**: select shapes, edit style — all 4 properties work

### Incremental Delivery

1. Phase 1 + Phase 2 → Style panel MVP
2. Phase 3 → Text properties added
3. Phase 4 → Persistence verified
4. Phase 5 → Clean build + all tests green

---

## Notes

- All test expected values come from `specs/003-style-and-text/acceptance.md` and `spec.md` — never from running the implementation
- `patchElement` spy in tests: use `vi.spyOn` on the mutation-pipeline module
- `DetailPanel` reads from stores directly (no props) — tests must seed store state before rendering
- `line` elements: fill color control MUST be hidden (no fill for lines per FR-004)
- Opacity: panel slider is 0–100 (integer), stored as 0.0–1.0 (float) — convert on input/display
