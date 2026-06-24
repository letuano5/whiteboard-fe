# Tasks: Back to Content & Trackpad Support

**Input**: Design documents from `specs/007-back-to-content-trackpad/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅

**Tests**: TDD approach — write tests first, ensure they FAIL, then implement.

**Organization**: Tasks grouped by user story. US2 (Smooth Trackpad Zoom) and US3 (Trackpad Two-Finger Pan) share one phase because they modify the same `handleWheel` function in Whiteboard.tsx.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

---

## Phase 1: Foundational — Camera Utilities

**Purpose**: Add utility functions and constants to `src/utils/camera.ts` that all user stories depend on. MUST complete before any story work begins.

**⚠️ CRITICAL**: All user story phases depend on this.

- [ ] T001 Add constants `ZOOM_SENSITIVITY = 0.001` and `FIT_PADDING = 0.85` to `src/utils/camera.ts`
- [ ] T002 Add `getContentBounds(elements: Element[]): { minX: number; minY: number; maxX: number; maxY: number } | null` to `src/utils/camera.ts` — returns null when no non-deleted elements exist
- [ ] T003 Add `isAnyElementVisible(elements: Element[], camera: Camera, viewportW: number, viewportH: number): boolean` to `src/utils/camera.ts` — returns true if any non-deleted element's bbox intersects the viewport rect
- [ ] T004 Add `fitToContent(elements: Element[], camera: Camera, viewportW: number, viewportH: number): Camera` to `src/utils/camera.ts` — uses `FIT_PADDING` and clamps to `[MIN_ZOOM, MAX_ZOOM]`; centers camera on content bbox

**Checkpoint**: All four exports present and TypeScript compiles (`pnpm typecheck`).

---

## Phase 2: User Story 1 — Back to Content Button (Priority: P1) 🎯 MVP

**Goal**: A floating "Back to content" button appears when all non-deleted shapes are off-screen; clicking it fits the camera to all content with padding.

**Independent Test**: Draw a shape → pan far away → button appears → click → all content visible.

### Tests for User Story 1 ⚠️ Write first — ensure FAIL before T008

- [ ] T005 [US1] Add unit tests for `getContentBounds` in `src/utils/camera.test.ts` — test: empty array → null, all isDeleted → null, mixed → correct bbox (@covers AC-3, AC-5)
- [ ] T006 [US1] Add unit tests for `isAnyElementVisible` in `src/utils/camera.test.ts` — test: element inside viewport → true, element outside → false, deleted element → false (@covers AC-1, AC-2, AC-5)
- [ ] T007 [US1] Add unit tests for `fitToContent` in `src/utils/camera.test.ts` — test: single element → camera centers on it with padding; deleted elements excluded (@covers AC-4, AC-5)
- [ ] T008 [P] [US1] Create `src/components/back-to-content/__tests__/BackToContent.test.tsx` — render with elements all off-screen → button visible; ≥1 element on-screen → no button; empty elements → no button; click → calls setCamera with fit result (@covers AC-1, AC-2, AC-3, AC-4, AC-5)

### Implementation for User Story 1

- [ ] T009 [US1] Create `src/components/back-to-content/BackToContent.tsx` — subscribes to `useElementsStore` and `useCameraStore`; accepts `containerRef: React.RefObject<HTMLDivElement>`; reads `containerRef.current.getBoundingClientRect()` to get viewport size; computes `showButton = hasContent && !isAnyElementVisible(...)`; renders an absolutely-positioned button at bottom-center of container
- [ ] T010 [US1] Import and render `<BackToContent containerRef={containerRef} />` inside the container div in `src/canvas/Whiteboard.tsx` (after `<DetailPanel />`)

**Checkpoint**: `pnpm test` passes for US1 tests. Draw shape → pan away → button visible → click → content fits.

---

## Phase 3: User Stories 2 & 3 — Trackpad Wheel (Zoom + Pan) (Priority: P2)

**Goal**: Two-finger scroll pans the canvas; pinch or Ctrl+wheel zooms with smooth sensitivity; deltaMode is normalized.

**Independent Test**: Two-finger scroll → canvas pans, zoom unchanged. Ctrl+scroll → canvas zooms smoothly.

### Tests for User Stories 2 & 3 ⚠️ Write first — ensure FAIL before T013

- [ ] T011 [US2] Add tests to `src/canvas/__tests__/zoom-pan.test.ts` — dispatch wheel event with `ctrlKey: true, deltaY: 3` → `zoomTo` called, `panBy` NOT called; zoom factor = exp(-3 × 0.001); zoom clamped at MIN/MAX (@covers AC-7, AC-8, AC-9)
- [ ] T012 [US3] Add tests to `src/canvas/__tests__/zoom-pan.test.ts` — dispatch wheel event with `ctrlKey: false, deltaX: 50, deltaY: 30` → `panBy` called with (50/zoom, 30/zoom), `zoomTo` NOT called; deltaMode=1 multiplies by 16; deltaMode=2 multiplies by container dimension (@covers AC-6, AC-12)

### Implementation for User Stories 2 & 3

- [ ] T013 [US2] Modify `handleWheel` in `src/canvas/Whiteboard.tsx`:
  - Replace the current always-zoom logic with: if `e.ctrlKey || e.metaKey` → zoom path; else → pan path
  - Zoom path: normalize delta for `deltaMode`, compute `factor = Math.exp(-normalizedDelta * ZOOM_SENSITIVITY)` from `src/utils/camera.ts`, call `zoomTo(cam.zoom * factor, pivot)` where `pivot = { x: e.clientX - rect.left, y: e.clientY - rect.top }` (cursor position in screen coords)
  - Pan path: normalize `e.deltaX` and `e.deltaY` for `deltaMode`, call `panBy(normDX / cam.zoom, normDY / cam.zoom)`

**Checkpoint**: `pnpm test` passes for US2+US3 tests. Trackpad two-finger scroll pans; Ctrl+pinch zooms smoothly.

---

## Phase 4: User Story 4 — Select Mode Hint (Priority: P3)

**Goal**: Small hint text "Click chuột giữa để scroll canvas" visible only when Select tool is active.

**Independent Test**: Select tool active → hint visible; switch to any other tool → hint gone.

### Tests for User Story 4 ⚠️ Write first — ensure FAIL before T015

- [ ] T014 [US4] Add render tests to `src/canvas/__tests__/zoom-pan.test.ts` (or a new `src/canvas/__tests__/whiteboard-hint.test.tsx`) — render Whiteboard with `tool='select'` → hint text present; render with `tool='hand'` → hint text absent (@covers AC-10, AC-11)

### Implementation for User Story 4

- [ ] T015 [US4] In `src/canvas/Whiteboard.tsx`, subscribe to `tool` from `useInteractionStore`; add a small `<div>` overlay (absolutely positioned, bottom-left, muted Tailwind classes, pointer-events-none) that renders `"Click chuột giữa để scroll canvas"` when `tool === 'select'`

**Checkpoint**: `pnpm test` passes for US4 tests. Switch tools → hint toggles.

---

## Phase 5: Polish & Cross-Cutting

**Purpose**: Type-check, lint, and verify full test suite.

- [ ] T016 [P] Run `pnpm typecheck` — fix any TypeScript errors introduced across all modified files
- [ ] T017 [P] Run `pnpm lint` — fix any lint warnings in `src/utils/camera.ts`, `src/canvas/Whiteboard.tsx`, `src/components/back-to-content/BackToContent.tsx`
- [ ] T018 Run `pnpm test` — ensure no regressions in existing tests (`zoom-pan.test.ts`, `camera.test.ts`, `SvgLayer.test.tsx`, `Toolbar.test.tsx`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies — start immediately.
- **Phase 2 (US1)**: Depends on Phase 1 (uses `getContentBounds`, `isAnyElementVisible`, `fitToContent`).
- **Phase 3 (US2+US3)**: Depends on Phase 1 (uses `ZOOM_SENSITIVITY`). Can run in parallel with Phase 2.
- **Phase 4 (US4)**: No dependencies on Phase 2 or 3 — can start after Phase 1.
- **Phase 5 (Polish)**: Depends on all phases complete.

### Within Each Phase

- Tests MUST be written and FAIL before implementation.
- T005, T006, T007 are sequential (same file `camera.test.ts`).
- T008 is independent of T005–T007 (different file) → [P] with them.
- T011, T012 are sequential (same file `zoom-pan.test.ts`).
- T016 and T017 are independent → [P].

### Parallel Opportunities

```
Phase 1: T001 → T002 → T003 → T004 (sequential, same file)
Phase 2: T005 → T006 → T007, T008 [P with T005-T007]
         Then T009 → T010 (sequential)
Phase 3: T011 → T012 (sequential, same file)
         Then T013
Phase 4: T014 → T015 (sequential)
Phase 3 can start in parallel with Phase 2 after Phase 1 completes.
Phase 4 can start in parallel with Phase 2 and 3 after Phase 1 completes.
Phase 5: T016 [P] T017, then T018
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Foundational utilities (T001–T004)
2. Phase 2: Back to Content button (T005–T010)
3. **STOP and VALIDATE**: All AC-1 through AC-5 covered.

### Full Delivery

1. Phase 1 → Phase 2 (parallel: Phase 3 + Phase 4) → Phase 5
2. Each phase produces independently testable value.

---

## Notes

- `ZOOM_SENSITIVITY` from `src/utils/camera.ts` is the single source for the AC-8 constant.
- `@covers AC-n` tags in test comments must match `acceptance.md` registry exactly.
- Wheel event tests in `zoom-pan.test.ts` use `new WheelEvent(...)` dispatched on the container element (see existing test pattern in that file).
- BackToContent reads `containerRef.current` at click time (not on render) to avoid stale sizes.
