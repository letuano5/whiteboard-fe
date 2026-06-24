# Tasks: P1B-03 Inline Text Editing (Double-click + Auto-bbox)

**Input**: Design documents from `specs/009-inline-text-edit/`

**Prerequisites**: plan.md ✅ spec.md ✅ data-model.md ✅ acceptance.md ✅

**Organization**: Grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Extend `InteractionState` with `editingId` — required by ALL downstream tasks.

**⚠️ CRITICAL**: Must complete before any user-story phase.

- [ ] T001 Add `editingId: string | null` field to `InteractionState` interface in `src/types/interaction.ts`
- [ ] T002 Add `editingId: null` to `DEFAULT_STATE` and `setEditingId(id: string | null)` action to `src/store/interaction.store.ts`

**Checkpoint**: `interaction.store.ts` exposes `editingId` + `setEditingId`; `pnpm typecheck` passes.

---

## Phase 2: User Story 1 — Edit text element via double-click (Priority: P1) 🎯 MVP

**Goal**: User double-clicks a text element, types new content, blurs/Escapes to commit. Element bbox auto-sizes.

**Independent Test**: Create a text element, double-click it, type "Hello", blur → element shows "Hello" with correct bbox.

### Tests (TDD — write first, verify they FAIL before implementation)

- [ ] T003 [P] [US1] Write AC-1 test: double-clicking a text element sets `editingId` — `@covers AC-1` in `src/canvas/tools/__tests__/text-editor.test.tsx`
- [ ] T004 [P] [US1] Write AC-2 test: blur fires `patchElement` with new `props.text` — `@covers AC-2` in `src/canvas/tools/__tests__/text-editor.test.tsx`
- [ ] T005 [P] [US1] Write AC-3 test: Escape key fires `patchElement` with new `props.text` and closes editor — `@covers AC-3` in `src/canvas/tools/__tests__/text-editor.test.tsx`  
  <!-- INTENTIONAL: Escape = commit (not discard), per spec "Blur/Esc commit" — do NOT change to discard -->
- [ ] T006 [P] [US1] Write AC-4 test: after commit, `patchElement` receives updated `width`/`height` matching measured div dimensions — `@covers AC-4` in `src/canvas/tools/__tests__/text-editor.test.tsx`
- [ ] T007 [P] [US1] Write AC-5 test: editor `style.left`, `style.top`, and `style.fontSize` reflect camera zoom; also assert `style.transform` contains `rotate(Ndeg)` when `el.angle !== 0` — `@covers AC-5` in `src/canvas/tools/__tests__/text-editor.test.tsx`
- [ ] T008 [P] [US1] Write AC-8 test: `editingId` equals element id while editor is open and returns to `null` on close — `@covers AC-8` in `src/canvas/tools/__tests__/text-editor.test.tsx`

### Implementation for User Story 1

- [ ] T009 [US1] Create `TextEditor` component in `src/canvas/tools/text-editor.tsx`:
  - Props: `element: Element`, `camera: Camera`, `onClose: () => void`
  - Position via `left=(el.x - camera.x)*zoom`, `top=(el.y - camera.y)*zoom`, `fontSize=(el.props.fontSize??16)*zoom`
  - Rotation: `transform-origin: ${el.width*zoom/2}px ${el.height*zoom/2}px; transform: rotate(${el.angle*180/Math.PI}deg)`
  - On mount: `ref.current.focus(); ref.current.innerText = el.props.text ?? ''`
  - On blur: commit → `patchElement(el.id, { props: {...el.props, text: innerText}, width: scrollWidth/zoom, height: scrollHeight/zoom })` → `setEditingId(null)`
  - On `keydown Escape`: commit (same as blur) + `setEditingId(null)` (guard double-commit with ref flag)
  - Styling: `position: absolute; white-space: pre-wrap; word-break: break-word; min-width: 1ch; outline: none; background: transparent; border: 1px solid #3b82f6`
- [ ] T010 [US1] Add `onDoubleClick` handler to `<SvgLayer>` in `src/canvas/Whiteboard.tsx`:
  - Convert screen point → world via `screenToWorld`
  - Hit-test visible elements (highest zIndex first)
  - If hit element has `type === 'text'`: call `setEditingId(el.id)` and `setSelectedIds([el.id])`
  - Render `<TextEditor>` when `editingId` is not null (read element from store)
- [ ] T011 [US1] In `src/canvas/layers/SvgLayer.tsx`: accept `editingId?: string | null` prop; render any element with `id === editingId` at `opacity={0}` (not skipped) to preserve hit geometry
- [ ] T012 [US1] Wire `onDoubleClick` prop through `SvgLayer` component interface in `src/canvas/layers/SvgLayer.tsx` (add to props + `<svg onDoubleClick={onDoubleClick}>`)

**Checkpoint**: Double-click a text element → editor opens, text editable, blur commits, bbox updates. `pnpm test` green for T003–T008.

---

## Phase 3: User Story 2 — Empty text commits without deleting element (Priority: P2)

**Goal**: Clearing all text and blurring keeps the element with `props.text === ""`.

**Independent Test**: Double-click a text element, Ctrl+A + Delete, blur → element remains with empty `props.text`.

### Tests

- [ ] T013 [US2] Write AC-6 test: committing empty content results in `patchElement` with `text: ""` and element remains — `@covers AC-6` in `src/canvas/tools/__tests__/text-editor.test.tsx`

### Implementation for User Story 2

*(No separate implementation task — T009's commit logic already uses `innerText` which is `""` when empty. Verify T009 handles the empty case correctly.)*

- [ ] T014 [US2] Verify `TextEditor` commit path in `src/canvas/tools/text-editor.tsx`: ensure `innerText === ""` path calls `patchElement` with `text: ""` and does NOT call `deleteElements`

**Checkpoint**: Element with empty text persists after editor closes. T013 green.

---

## Phase 4: User Story 3 — Non-text element double-click (Priority: P3)

**Goal**: Double-clicking a rectangle/ellipse/diamond does not open the inline editor.

**Independent Test**: Double-click a rectangle → no editor appears, `editingId` stays `null`.

### Tests

- [ ] T015 [US3] Write AC-7 test: double-clicking a non-`text` element does not set `editingId` — `@covers AC-7` in `src/canvas/tools/__tests__/text-editor.test.tsx`

### Implementation for User Story 3

*(No separate implementation — T010's handler already guards `type === 'text'`. Verify the guard is correct.)*

- [ ] T016 [US3] Confirm that `onDoubleClick` handler in `src/canvas/Whiteboard.tsx` guards on `el.type === 'text'` before calling `setEditingId`

**Checkpoint**: Rectangle/ellipse double-click is a no-op for the editor. T015 green.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T017 [P] Run `pnpm typecheck` — fix any TypeScript errors introduced in T001–T016
- [ ] T018 [P] Run `pnpm lint` — fix any ESLint issues
- [ ] T019 Run `pnpm test` — all tests green (T003–T008, T013, T015)
- [ ] T020 Manual smoke-test via quickstart.md: all 6 scenarios pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately
- **US1 (Phase 2)**: Depends on Phase 1 (T001, T002) — BLOCKS test writing and implementation
- **US2 (Phase 3)**: Depends on Phase 2 complete (T009 implemented)
- **US3 (Phase 4)**: Depends on Phase 2 complete (T010 implemented)
- **Polish (Phase 5)**: Depends on all user-story phases complete

### Within User Story 1

- T003–T008 (tests): Write in parallel after T001+T002 — all go in same file, all parallel
- T009 (TextEditor component): After tests are written and failing
- T010 (Whiteboard double-click + render): After T009
- T011 (SvgLayer hiding): After T001+T002, parallel with T009
- T012 (SvgLayer prop wire): After T011

### Parallel Opportunities

- T003–T008 can be written in one batch (same file, no inter-dependencies)
- T009 and T011 can be developed in parallel (different files)
- T017 and T018 (typecheck + lint) can run in parallel

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1 (T001, T002) — ~10 min
2. Write tests T003–T008 and confirm they FAIL — ~20 min
3. Implement T009–T012 — ~40 min
4. Run tests, iterate until green — ~20 min
5. **Demo**: double-click → edit → commit → auto-bbox ✅

### Incremental Delivery

1. Phase 1 + Phase 2 → MVP (core editing)
2. Phase 3 → Empty text safety
3. Phase 4 → Guard on non-text elements
4. Phase 5 → Polish, lint, typecheck

---

## Notes

- `[P]` = different files, safe to parallelize
- Tests T003–T008 all go in `src/canvas/tools/__tests__/text-editor.test.tsx` — write as one batch
- Use `vi.fn()` to mock `patchElement` from `src/store/mutation-pipeline.ts`
- Use `vi.mock('../../store/interaction.store')` to inspect/control `editingId`
- `scrollWidth/scrollHeight` must be mocked in jsdom (returns 0 by default) — use `Object.defineProperty(el, 'scrollWidth', { value: N })` in tests
- Never edit test expected values to match implementation output — oracle comes from acceptance.md
