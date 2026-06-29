# Tasks: Remote Selection Highlight & Draft Preview (P2.5-04)

**Input**: Design documents from `specs/018-remote-selection-highlight/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ws-events.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on sibling tasks)
- **[Story]**: Which user story this task belongs to (US1 = remote selection highlight; US2 = remote draft preview)

---

## Phase 1: Setup (No new files — all changes are to existing files)

**Purpose**: Add the new WS event constant that both backend and frontend depend on.

- [x] T001 Add `ELEMENT_DRAFT: 'element-draft'` to `WS_EVENTS` in `packages/shared/src/index.ts`

**Checkpoint**: `pnpm typecheck` passes; both frontend and backend can now import `WS_EVENTS.ELEMENT_DRAFT`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend relay changes and frontend state shape — required before any user story can be implemented or tested.

**⚠️ CRITICAL**: Phases 3 and 4 cannot begin until this phase is complete.

- [x] T002 Extend `cursor-move` socket handler in `backend/src/index.ts` to forward `selectedIds` from incoming payload to peers in the relay
- [x] T003 Add `element-draft` socket handler in `backend/src/index.ts` that relays `{ sessionId, elements }` to room peers without storage
- [x] T004 Add `sessionId` field to the `ELEMENT_UPDATE` relay payload in `backend/src/index.ts` so frontend can identify which peer committed
- [x] T005 [P] Add `remoteDrafts: Map<string, Element[]>` to `InteractionState` interface in `frontend/src/types/interaction.ts`
- [x] T006 [P] Add `remoteDrafts: new Map()` to `DEFAULT_STATE` and add `setRemoteDrafts(drafts: Map<string, Element[]>): void` action in `frontend/src/store/interaction.store.ts`

**Checkpoint**: `pnpm typecheck` passes; server relays both cursor-move (with selectedIds) and element-draft; `interaction.store` has `remoteDrafts`.

---

## Phase 3: User Story 1 — Remote Selection Highlight (Priority: P1) 🎯 MVP

**Goal**: Peers see a colored selection border around elements another user has selected, using that user's assigned color.

**Independent Test**: Open two browser tabs in the same room. Select an element in tab A — tab B must show a solid colored border around that element. Deselect in A — border disappears in B. Close tab A — border disappears in B.

### Tests for User Story 1

- [x] T007 [P] [US1] Add unit test in `frontend/src/sync/__tests__/socket-client.test.ts`: **AC-1** — when `interaction.store.selectedIds` changes, `socket.emit` is called with `cursor-move` payload containing `selectedIds`
- [x] T008 [P] [US1] Add unit test in `frontend/src/sync/__tests__/socket-client.test.ts`: **AC-1** — incoming `cursor-move` with `selectedIds` field causes `remoteCursors[sessionId].selectedIds` to be updated in `interaction.store`
- [x] T009 [P] [US1] Add unit test in `frontend/src/canvas/layers/__tests__/SvgLayer.test.tsx`: **AC-1/AC-2** — when `remoteCursors` has an entry with `selectedIds` containing an element ID, a `<rect>` with `stroke` matching the peer's color is rendered for that element
- [x] T010 [P] [US1] Add unit test in `frontend/src/canvas/layers/__tests__/SvgLayer.test.tsx`: **AC-2** — when a remote peer has multiple `selectedIds`, a colored `<rect>` border renders around each selected element
- [x] T011 [P] [US1] Add unit test in `frontend/src/canvas/layers/__tests__/SvgLayer.test.tsx`: **AC-3** — when two remote peers each have distinct `selectedIds`, both colored borders render simultaneously using their respective colors
- [x] T012 [P] [US1] Add unit test in `frontend/src/canvas/layers/__tests__/SvgLayer.test.tsx`: **AC-4** — when a remote peer's `selectedIds` becomes `[]`, the previously rendered border is removed
- [x] T013 [P] [US1] Add unit test in `frontend/src/sync/__tests__/socket-client.test.ts`: **AC-5** — when `USER_LEAVE` fires for a sessionId, `remoteCursors` no longer contains that session, causing the border to disappear

### Implementation for User Story 1

- [x] T014 [US1] In `frontend/src/sync/socket-client.ts`, subscribe to `interaction.store.selectedIds` changes; on change, call `emitCursorMove` with the last known cursor (or null if cursor not available) AND include `selectedIds` in the payload — do NOT create a second separate `socket.emit('cursor-move')`; merge into the existing emission path so both cursor position and selection share the same throttled event (throttle at ≤ 50 ms)
- [x] T015 [US1] In `frontend/src/sync/socket-client.ts`, update the `CURSOR_MOVE` socket event handler to merge `selectedIds` (when present in the incoming payload) into `remoteCursors[sessionId]` via `setRemoteCursors`
- [x] T016 [US1] In `frontend/src/canvas/layers/SvgLayer.tsx`, read `remoteCursors` from `interaction.store` and render a solid (no dashes) `<rect>` with `stroke={peer.color}` and no fill for each element ID in each peer's `selectedIds` — look up element dimensions from `elements` prop; skip missing or deleted elements (element may have been deleted locally — render nothing in that case); render below local selection overlay

**Checkpoint**: Manual test — two tabs, select in A, B shows colored border. AC-1 through AC-5 all pass.

---

## Phase 4: User Story 2 — Remote Draft Preview (Priority: P2)

**Goal**: Peers see ghost previews of ongoing drags, resizes, and shape creations before the change is committed.

**Independent Test**: Two tabs in same room. Drag an element in tab A — tab B shows the element moving as a ghost in real time. Release in A — ghost replaced by committed element at full opacity. Press Escape mid-drag in A — ghost disappears, element snaps back.

### Tests for User Story 2

- [x] T017 [P] [US2] Add unit test in `frontend/src/sync/__tests__/socket-client.test.ts`: **AC-6 (start drag)** — when `interaction.store.draftElements` becomes non-empty, `socket.emit` is called with `element-draft` event containing those elements (throttled ≤ 50 ms)
- [x] T018 [P] [US2] Add unit test in `frontend/src/sync/__tests__/socket-client.test.ts`: **AC-8 (cancel/clear draft)** — when `draftElements` returns to `[]`, `socket.emit` is called with `element-draft` event with `elements: []`
- [x] T019 [P] [US2] Add unit test in `frontend/src/sync/__tests__/socket-client.test.ts`: **AC-6 (receive draft)** — incoming `element-draft` event with non-empty `elements` sets `remoteDrafts[sessionId]` to those elements in `interaction.store`
- [x] T020 [P] [US2] Add unit test in `frontend/src/sync/__tests__/socket-client.test.ts`: **AC-8 (receive clear)** — incoming `element-draft` with `elements: []` removes `remoteDrafts[sessionId]` from `interaction.store`
- [x] T021 [P] [US2] Add unit test in `frontend/src/sync/__tests__/socket-client.test.ts`: **AC-7 (commit clears draft)** — incoming `element-update` with a `sessionId` field clears `remoteDrafts[sessionId]`
- [x] T022 [P] [US2] Add unit test in `frontend/src/sync/__tests__/socket-client.test.ts`: **AC-5 (leave clears draft)** — `USER_LEAVE` for a sessionId also deletes that session from `remoteDrafts`
- [x] T023 [P] [US2] Add unit test in `frontend/src/canvas/layers/__tests__/SvgLayer.test.tsx`: **AC-6 (render ghost)** — when `remoteDrafts` has an entry with elements, each element renders at reduced opacity via its ShapeUtil
- [x] T024 [P] [US2] Add unit test in `frontend/src/canvas/layers/__tests__/SvgLayer.test.tsx`: **AC-7/AC-8 (ghost gone)** — when `remoteDrafts[sessionId]` is removed, the ghost elements no longer appear in the rendered output

### Implementation for User Story 2

- [x] T025 [US2] In `frontend/src/sync/socket-client.ts`, subscribe to `interaction.store` `draftElement` and `draftElements` state; on change, build a combined draft array (include `draftElement` for creation gestures AND single-element drag/resize, AND `draftElements` for multi-element drag) and emit `ELEMENT_DRAFT` via socket (throttled at 50 ms); emit `elements: []` when both are cleared; skip emission when no socket/room; receivers who do not yet have a draft element's ID in their committed store will render the ghost from draft data only and discard silently if the ID is unknown at commit time — note: `draftElement` is set by select-tool for single drag, resize, and rotation; `draftElements` is set for multi-drag; both are covered by this subscription
- [x] T026 [US2] In `frontend/src/sync/socket-client.ts`, add `ELEMENT_DRAFT` socket event handler: if `elements` is non-empty, call `setRemoteDrafts` updating the map entry for `sessionId`; if `elements` is `[]`, delete the entry and call `setRemoteDrafts`
- [x] T027 [US2] In `frontend/src/sync/socket-client.ts`, update the `ELEMENT_UPDATE` handler to accept optional `sessionId` in the payload and, when present, clear `remoteDrafts[sessionId]`; update the `USER_LEAVE` handler to also delete from `remoteDrafts`
- [x] T028 [US2] In `frontend/src/canvas/layers/SvgLayer.tsx`, read `remoteDrafts` from `interaction.store`; for each peer's draft elements, render a `<g opacity={0.5}>` containing `getShapeUtil(el.type).render(el)` plus a 1 px solid colored `<rect>` border using the peer's color from `remoteCursors`; render this layer after committed elements and before local drafts (z-order per data-model.md)

**Checkpoint**: Manual test — two tabs, drag in A, B shows ghost moving. Release — ghost replaced. Escape — ghost disappears. All US2 test tasks pass.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T029 [P] Run `pnpm typecheck` across all packages and fix any TypeScript errors introduced
- [x] T030 [P] Run `pnpm --filter whiteboard-fe test` and ensure all existing tests still pass alongside the new tests
- [x] T031 [P] Run `pnpm lint` and fix any linting issues in changed files
- [ ] T032 Perform manual end-to-end validation using `specs/018-remote-selection-highlight/quickstart.md` — run all 4 scenarios and confirm each expected outcome; include a 5-tab performance check for SC-004 (open 5 browser tabs in the same room, all actively dragging elements — confirm no visible frame-rate degradation); exercise at least 3 different element types (e.g., rectangle, ellipse, text) for both remote selection highlight and draft ghost to confirm SC-005

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001) — BLOCKS Phases 3 and 4
- **Phase 3 (US1)**: Depends on Phase 2 completion; test tasks T007–T013 can run in parallel; implementation tasks T014–T016 in sequence
- **Phase 4 (US2)**: Depends on Phase 2 completion; can start in parallel with Phase 3 after Phase 2 is done
- **Phase 5 (Polish)**: Depends on Phases 3 and 4 being complete

### User Story Dependencies

- **US1 (P1)**: No dependency on US2
- **US2 (P2)**: No dependency on US1 (both depend only on foundational phase); US2 rendering in SvgLayer (T028) builds on top of T016's remote-cursor read, so T016 should ideally be done first, but T028 can be coded in parallel

### Within Each User Story

- Tests (T007–T013, T017–T024) can all be written in parallel before or alongside implementation
- T014 → T015 → T016 are sequential (networking then rendering) for US1
- T025 → T026 → T027 → T028 are sequential for US2

### Parallel Opportunities

- T005 and T006 can run in parallel (different files)
- T002, T003, T004 are all in `backend/src/index.ts` — must be sequential within that file
- T007–T013 all [P] — can be written simultaneously (all in test files)
- T017–T024 all [P] — can be written simultaneously
- T029, T030, T031 all [P] — run simultaneously in CI

---

## Parallel Example: User Story 1 Tests

```bash
# All US1 test tasks can be written simultaneously:
T007: socket-client emit selectedIds on selection change
T008: socket-client receive selectedIds → update remoteCursors
T009: SvgLayer renders single remote selection border
T010: SvgLayer renders multiple selected elements
T011: SvgLayer renders simultaneous multi-user selections
T012: SvgLayer removes border when selectedIds=[]
T013: socket-client USER_LEAVE removes selection from map
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: T001
2. Complete Phase 2 (backend relay): T002, T003, T004
3. Complete Phase 2 (frontend state): T005, T006
4. Write US1 tests: T007–T013 (write, verify they FAIL)
5. Implement US1: T014, T015, T016
6. **STOP and VALIDATE**: Confirm T007–T013 pass; run quickstart Scenario 1
7. Ship MVP — remote selection highlight is live

### Incremental Delivery

1. After MVP: Write US2 tests T017–T024
2. Implement US2: T025, T026, T027, T028
3. Run quickstart Scenarios 2–4
4. Complete Phase 5 polish

---

## AC-to-Task Traceability

| Acceptance Criterion | Test Task | Impl Task(s) |
|---|---|---|
| US1 AC-1: Single selection → colored border | T007, T008, T009 | T014, T015, T016 |
| US1 AC-2: Multi-selection → all bordered | T010 | T016 |
| US1 AC-3: Two peers → both visible simultaneously | T011 | T016 |
| US1 AC-4: Deselect → border disappears | T012 | T015 |
| US1 AC-5: User leaves → highlight disappears | T013 | T015 |
| US2 AC-6: Drag → ghost visible real time | T017, T019, T023 | T025, T026, T028 |
| US2 AC-7: Commit → ghost replaced by committed | T021, T024 | T027, T028 |
| US2 AC-8: Cancel (Escape) → ghost disappears | T018, T020, T024 | T025, T026 |
| US2 AC-7 (resize): Resize → live ghost | T023 | T025, T028 |
| US2 AC-8 (create): Drawing → ghost grows | T023 | T025, T028 |
