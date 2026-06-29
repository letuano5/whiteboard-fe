# Tasks: Multi-select + Duplicate/Copy-Paste (P2-08)

**Input**: Design documents from `specs/016-multi-select-copy-paste/`

**Organization**: Tasks grouped by user story for independent implementation and testing.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure changes that unblock all user stories.

- [ ] T001 Add `createElements(drafts: ElementDraft[]): Element[]` batch function to `frontend/src/store/mutation-pipeline.ts` — fires ONE MutationEvent (`type:'create'`, `before:[]`) for all elements
- [ ] T002 Add `clipboard: Element[] | null`, `pasteOffset: number`, `draftElements: Element[]` to `InteractionState` and `InteractionActions` in `frontend/src/store/interaction.store.ts`; add `setClipboard`, `setPasteOffset`, `setDraftElements` actions

**Checkpoint**: Store and pipeline ready — user story work can begin.

---

## Phase 2: User Story 1 + 2 — Marquee + Shift-click Selection (Priority: P1) 🎯 MVP

**Goal**: Users can select multiple shapes using rubber-band marquee and Shift-click.

**Independent Test**: Draw 3 shapes; drag a rectangle over 2 → both selected. Then Shift-click the third → 3 selected. Shift-click one → 2 remain. Click empty → cleared.

### Tests — Selection (write first, must FAIL before implementation)

- [ ] T003 [P] [US1] Write test: marquee selects shapes whose bounding box intersects the rect (`@covers AC-1`) in `frontend/src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T004 [P] [US1] Write test: releasing marquee with no shapes clears selection (`@covers AC-2, AC-3`) in `frontend/src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T005 [P] [US1] Write test: Shift-click adds unselected shape to selection (`@covers AC-4`) in `frontend/src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T006 [P] [US1] Write test: Shift-click selected shape removes it (`@covers AC-5`) in `frontend/src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T007 [P] [US1] Write test: Shift-click with empty selection selects shape (`@covers AC-6`) in `frontend/src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T008 [P] [US1] Write test: plain click on empty canvas clears selection (`@covers AC-7`) in `frontend/src/canvas/tools/__tests__/select-tool.test.ts`

### Implementation — Selection

- [ ] T009 [US1] Extend `onSelectPointerDown` in `frontend/src/canvas/tools/select-tool.ts` to accept `shiftKey: boolean`; implement shift-toggle and marquee-start logic (plan § Design Details § 3)
- [ ] T010 [US1] Extend `onSelectPointerMove` in `frontend/src/canvas/tools/select-tool.ts` to update `marquee` state (normalized rect) when marquee drag is active
- [ ] T011 [US1] Extend `onSelectPointerUp` in `frontend/src/canvas/tools/select-tool.ts` to compute intersecting elements from `marquee`, call `setSelectedIds`, and clear marquee
- [ ] T012 [US1] Update `Whiteboard.tsx` pointer handler to pass `shiftKey` to `onSelectPointerDown` and to call `setPointerCapture` during marquee drag in `frontend/src/canvas/Whiteboard.tsx`
- [ ] T013 [US1] Render marquee `<rect>` (light blue fill 10% opacity, dashed blue border) in the `<g>` transform group of `frontend/src/canvas/layers/SvgLayer.tsx`
- [ ] T014 [US1] Render multi-select union bounding box `<rect>` (blue dashed, no handles) in `frontend/src/canvas/layers/SvgLayer.tsx` when `selectedIds.length > 1`

**Checkpoint**: Marquee and Shift-click work; multi-select bounding box visible. Tests T003–T008 pass.

---

## Phase 3: User Story 3 — Bulk Move / Style / Delete (Priority: P2)

**Goal**: All bulk operations (move, style, delete) apply to every selected shape atomically.

**Independent Test**: Select 3 shapes; drag one → all 3 move by same delta. Change stroke color → all 3 update. Delete → all 3 gone. Each is a single undo step.

### Tests — Bulk Operations

- [ ] T015 [P] [US3] Write test: dragging one of N selected shapes moves all by same (dx,dy) (`@covers AC-8`) in `frontend/src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T016 [P] [US3] Write test: style change via updateElements applies to all selected (`@covers AC-9`) in `frontend/src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T017 [P] [US3] Write test: Delete key removes all selected shapes (`@covers AC-10`) in `frontend/src/canvas/tools/__tests__/select-tool.test.ts`

### Implementation — Bulk Operations

- [ ] T018 [US3] Extend `onSelectPointerMove` in `frontend/src/canvas/tools/select-tool.ts` to populate `draftElements` with all selected elements offset by (dx,dy) when `selectedIds.length > 1`
- [ ] T019 [US3] Extend `onSelectPointerUp` in `frontend/src/canvas/tools/select-tool.ts` to call `updateElements` for all selected elements when multi-drag commits, then clear `draftElements`
- [ ] T020 [US3] Update `SvgLayer.tsx` to render `draftElements` array as draft shapes during multi-drag AND hide the corresponding committed elements (same pattern as single `draftElement`) in `frontend/src/canvas/layers/SvgLayer.tsx`
- [ ] T021 [US3] Update `DetailPanel.tsx` to show style controls when `selectedIds.length > 1` and patch all via `updateElements` on change in `frontend/src/components/detail-panel/DetailPanel.tsx`

**Checkpoint**: Bulk move, style, delete all work. Multi-drag shows live preview. Tests T015–T017 pass.

---

## Phase 4: User Story 4 — Duplicate (Ctrl/Cmd+D) (Priority: P2)

**Goal**: Pressing Ctrl/Cmd+D duplicates all selected shapes at (+10, +10) offset, selects copies.

**Independent Test**: Select 1 shape → Ctrl+D → copy at (+10,+10) selected; original deselected. Select 2 → Ctrl+D → 2 copies; one undo step reverts both. Nothing selected → no-op.

### Tests — Duplicate

- [ ] T022 [P] [US4] Write test: Ctrl+D with one selection creates copy at (+10,+10), selects copy, deselects original (`@covers AC-11`) in `frontend/src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T023 [P] [US4] Write test: Ctrl+D with multiple selection creates copies of all at (+10,+10) (`@covers AC-12`) in `frontend/src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T024 [P] [US4] Write test: Ctrl+D with empty selection is no-op (`@covers AC-13`) in `frontend/src/canvas/tools/__tests__/select-tool.test.ts`

### Implementation — Duplicate

- [ ] T025 [US4] Add `onDuplicateSelected()` function to `frontend/src/canvas/tools/select-tool.ts`: deep-clone selected elements at (+10,+10); call `createElements(drafts)`; `setSelectedIds(newIds)`
- [ ] T026 [US4] Extend `onSelectKeyDown` in `frontend/src/canvas/tools/select-tool.ts` to handle `Ctrl/Cmd+d` → call `onDuplicateSelected()`
- [ ] T027 [US4] Wire `Ctrl/Cmd+D` keyboard shortcut in the select-tool `useEffect` in `frontend/src/canvas/Whiteboard.tsx`

**Checkpoint**: Ctrl+D duplicates correctly; single undo step. Tests T022–T024 pass.

---

## Phase 5: User Story 5 — Copy/Paste (Ctrl/Cmd+C / Ctrl/Cmd+V) (Priority: P3)

**Goal**: Ctrl+C stores shapes to in-memory clipboard; Ctrl+V pastes with incrementing offset; repeated pastes keep offsetting.

**Independent Test**: Select 2 → Ctrl+C → selection unchanged. Ctrl+V → 2 copies at (+10,+10). Ctrl+V again → 2 more copies at (+20,+20). Empty clipboard Ctrl+V → no-op.

### Tests — Copy/Paste

- [ ] T028 [P] [US5] Write test: Ctrl+C stores copies to clipboard; selection unchanged (`@covers AC-14`) in `frontend/src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T029 [P] [US5] Write test: Ctrl+V pastes at (+10,+10); clipboard persists for re-paste (`@covers AC-15`) in `frontend/src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T030 [P] [US5] Write test: second Ctrl+V offsets by additional (+10,+10) from first paste (`@covers AC-16`) in `frontend/src/canvas/tools/__tests__/select-tool.test.ts`
- [ ] T031 [P] [US5] Write test: Ctrl+V with empty clipboard is no-op (`@covers AC-17`) in `frontend/src/canvas/tools/__tests__/select-tool.test.ts`

### Implementation — Copy/Paste

- [ ] T032 [US5] Add `onCopySelected()` to `frontend/src/canvas/tools/select-tool.ts`: deep-clone selected elements → `setClipboard(clones)`; `setPasteOffset(0)`
- [ ] T033 [US5] Add `onPasteSelected()` to `frontend/src/canvas/tools/select-tool.ts`: offset = `(pasteOffset+1)*10`; build drafts from clipboard; `createElements(drafts)`; `setSelectedIds(newIds)`; `setPasteOffset(pasteOffset+1)`
- [ ] T034 [US5] Extend `onSelectKeyDown` in `frontend/src/canvas/tools/select-tool.ts` to handle `Ctrl/Cmd+c` → `onCopySelected()` and `Ctrl/Cmd+v` → `onPasteSelected()`
- [ ] T035 [US5] Wire `Ctrl/Cmd+C` and `Ctrl/Cmd+V` keyboard shortcuts in the select-tool `useEffect` in `frontend/src/canvas/Whiteboard.tsx`

**Checkpoint**: Full clipboard workflow operational. Tests T028–T031 pass.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T036 [P] Run `pnpm typecheck` from repo root; fix any TypeScript errors introduced by store changes
- [ ] T037 [P] Run `pnpm lint` from repo root; fix any lint errors
- [ ] T038 Run `pnpm test` from repo root; confirm all T003–T031 pass
- [ ] T039 Validate manually against quickstart.md scenarios S1–S7

---

## Dependencies & Execution Order

- **Phase 1 (Foundational)**: No dependencies — start immediately.
- **Phases 2–5**: All depend on Phase 1 completion. Can be worked sequentially or in priority order.
- **Phase 6**: Depends on all implementation phases complete.

### Within Each Phase

- Write tests FIRST (must FAIL before implementation).
- Implementation tasks within a phase can be parallelized where marked [P].

---

## Implementation Strategy

### MVP (Phase 1 + 2)

1. Phase 1 → Phase 2 → validate marquee + shift-click works.
2. **STOP and VALIDATE** before moving to bulk ops.

### Incremental Delivery

1. Phase 1 → foundational store + pipeline changes.
2. Phase 2 → marquee + shift-click (US1, US2).
3. Phase 3 → bulk move/style/delete (US3).
4. Phase 4 → duplicate (US4).
5. Phase 5 → copy/paste (US5).
6. Phase 6 → polish.
