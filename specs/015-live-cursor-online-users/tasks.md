# Tasks: Live Cursor & Online Users

**Input**: Design documents from `specs/015-live-cursor-online-users/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/websocket.md ✅

**Tests**: Vitest 4.x — one test task per AC-n, tagged `@covers AC-n`.

**Organization**: Tasks grouped by user story. US1 (live cursors) is the MVP; US2 (online panel) can layer on top.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to
- Exact file paths are included in every task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New files and extension points that both user stories depend on.

- [ ] T001 Create `frontend/src/sync/presence.ts` — export `LOCAL_PRESENCE` const with `{ sessionId: crypto.randomUUID(), name, color }` using a curated name list and 10-color hex palette
- [ ] T002 [P] Add `emitCursorMove(cursor: {x:number,y:number}): void` export to `frontend/src/sync/socket-client.ts` (emit `WS_EVENTS.CURSOR_MOVE` with roomId + sessionId from `LOCAL_PRESENCE`)
- [ ] T003 [P] Extend `backend/src/index.ts` to add `roomPresence: Map<string, Map<string, Presence>>` and `socket.data` typing for `sessionId` + `roomId`

**Checkpoint**: Session identity stable; socket helpers scaffolded; presence map ready on server.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire session identity into the join flow so every peer knows who just connected. Both user stories require this.

- [ ] T004 Extend `JOIN_ROOM` handler in `backend/src/index.ts` to accept `{ roomId, sessionId, name, color }`, store `Presence` in `roomPresence`, save `socket.data.sessionId` + `socket.data.roomId`, and emit `WS_EVENTS.USER_JOIN` with `{ presences: [...roomPresence.get(roomId).values()] }` to the whole room
- [ ] T005 Add `disconnect` handler in `backend/src/index.ts` to remove socket from `roomPresence`, emit `WS_EVENTS.USER_LEAVE` with `{ sessionId }` to the room
- [ ] T006 Extend `initSocketClient(roomId)` in `frontend/src/sync/socket-client.ts` to include `LOCAL_PRESENCE` fields in `JOIN_ROOM` payload: `{ roomId, sessionId, name, color }`
- [ ] T007 Add `USER_JOIN` handler in `initSocketClient` → receives `{ presences: Presence[] }` → calls `setRemoteCursors` merging all entries, filtering out own `sessionId`
- [ ] T008 Add `USER_LEAVE` handler in `initSocketClient` → receives `{ sessionId }` → removes entry from `remoteCursors` and calls `setRemoteCursors`

**Checkpoint**: Two tabs in the same room → `interaction.store.remoteCursors` has one entry for the other tab; leaves trigger removal.

---

## Phase 3: User Story 1 — Live Cursors (Priority: P1) 🎯 MVP

**Goal**: Remote users' cursors appear and track in real time as labeled overlays.

**Independent Test**: Open two tabs in same room → move mouse in Tab A → labeled cursor overlay appears and moves in Tab B. Pan/zoom Tab B → cursor stays at correct canvas position.

### Tests for US1

> Write tests first; verify they fail before implementing the corresponding production code.

- [ ] T009 [P] [US1] Write Vitest test in `frontend/src/sync/__tests__/socket-client.test.ts`:
  - `@covers AC-1` — `CURSOR_MOVE` event received → `remoteCursors` map gains an entry for the sender's sessionId with the received position
  - `@covers AC-2` — second `CURSOR_MOVE` with new position → entry updated to new coords
  - `@covers AC-3` — `CURSOR_MOVE` with own `sessionId` (from `LOCAL_PRESENCE`) → entry is NOT added to `remoteCursors`
  - `@covers AC-4` — `CURSOR_MOVE` emitted includes `roomId` so server can scope relay to correct room; also verify `USER_LEAVE` received → matching session removed from `remoteCursors` (`@covers AC-5`)

- [ ] T010 [P] [US1] Write Vitest test in `frontend/src/sync/__tests__/cursor-throttle.test.ts`:
  - `@covers AC-6` — emit helper called with rapid mouse events → `emitCursorMove` called at most once per 33 ms window (use fake timers)

- [ ] T011 [P] [US1] Write Vitest test in `frontend/src/sync/__tests__/cursor-coords.test.ts`:
  - `@covers AC-7` — `worldToScreen(cursor.x, cursor.y, camera)` output changes when camera changes, but the world-coord values stored in `remoteCursors` remain unchanged

### Implementation for US1

- [ ] T012 [US1] Add `CURSOR_MOVE` handler in `initSocketClient` in `frontend/src/sync/socket-client.ts`: receive `{ sessionId, cursor }` → patch cursor field in matching `remoteCursors` entry via `setRemoteCursors`
- [ ] T013 [US1] Create `frontend/src/canvas/layers/CursorOverlay.tsx` — full-viewport absolute div (`pointer-events: none; position: absolute; inset: 0; overflow: hidden`); reads `remoteCursors` from `useInteractionStore`, `camera` from `useCameraStore`; for each presence with `cursor != null` computes `screenPt = worldToScreen(cursor.x, cursor.y, camera)` and renders a positioned indicator (SVG arrow + name pill in `presence.color`)
- [ ] T014 [US1] Add cursor broadcasting in `frontend/src/canvas/Whiteboard.tsx`: add `lastCursorSent = useRef(0)`; in `handlePointerMove`, after existing logic, throttle-check (`Date.now() - lastCursorSent.current >= 33`), then call `emitCursorMove(worldPt)` and update ref
- [ ] T015 [US1] Mount `<CursorOverlay />` in `frontend/src/canvas/Whiteboard.tsx` as a sibling div placed immediately AFTER `<SvgLayer />` in DOM order inside the container div; give it `style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}` so it paints above the SVG layer but below UI panels (Toolbar/DetailPanel/ShareLinkButton which have higher zIndex)
- [ ] T016 [US1] Add `CURSOR_MOVE` relay in `backend/src/index.ts`: receive `{ roomId, sessionId, cursor }` → emit `WS_EVENTS.CURSOR_MOVE` with `{ sessionId, cursor }` to the room excluding sender (server does NOT store cursor position)
- [ ] T017 [US1] Handle `USER_LEAVE` in `CursorOverlay.tsx`: since the store already removes the entry (T008), verify the overlay reactively removes the cursor when `remoteCursors` loses the session (Zustand selector re-render)
- [ ] T018 [US1] Handle cursor disappear on own disconnect: in `stopSocketClient` in `frontend/src/sync/socket-client.ts`, import `useInteractionStore` from `../store/interaction.store` (same pattern as `apply-remote.ts` imports `useElementsStore`) and call `useInteractionStore.getState().setRemoteCursors(new Map())` to clear all remote cursors on cleanup

**Checkpoint**: US1 fully functional — live cursors appear, track, and disappear correctly. Canvas interactions unaffected.

---

## Phase 4: User Story 2 — Online Users Panel (Priority: P2)

**Goal**: A panel in the top-right corner lists all connected users (name + color badge), updating on join/leave.

**Independent Test**: Open two tabs in same room → both panels show two users. Close one tab → remaining tab's panel drops to one user within ~200 ms.

### Tests for US2

- [ ] T019 [P] [US2] Write Vitest test in `frontend/src/components/__tests__/online-users-panel.test.tsx`:
  - `@covers AC-8` — `OnlineUsersPanel` rendered with `remoteCursors` containing two presences → renders two name badges
  - `@covers AC-9` — `remoteCursors` updated to add a third presence → panel renders three badges
  - `@covers AC-10` — `remoteCursors` updated to remove a presence → panel renders one fewer badge
  - `@covers AC-11` — `remoteCursors` is empty → panel renders exactly one entry (local user / self)

### Implementation for US2

- [ ] T020 [P] [US2] Create `frontend/src/components/ui/OnlineUsersPanel.tsx` — reads `remoteCursors` from `useInteractionStore`; also imports `LOCAL_PRESENCE` from `presence.ts` to render self at top as first entry (labeled "(you)"); each row: colored circle div + name text; styles via Tailwind CSS 4
- [ ] T021 [US2] Mount `<OnlineUsersPanel />` in `frontend/src/canvas/Whiteboard.tsx` positioned in top-right area alongside `<ShareLinkButton />`; stack them vertically (panel above or below share button, separated by a gap)

**Checkpoint**: US1 + US2 both functional — cursors and online panel work together.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T022 [P] Verify `pointer-events: none` on `CursorOverlay` does not intercept any mouse/pointer events — manual test per quickstart.md Scenario "Verify no interference"
- [ ] T023 [P] Verify cursor labels do not overflow viewport edge (clamp position or hide partially-off-screen cursors) in `CursorOverlay.tsx`
- [ ] T024 Run `pnpm typecheck` from repo root and fix any TypeScript errors introduced by new files
- [ ] T025 Run `pnpm lint` and fix any ESLint issues
- [ ] T026 Run `pnpm test` and confirm all AC-n tests pass (T009–T011, T019)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 completion — blocks both user stories
- **Phase 3 (US1)**: Depends on Phase 2 — tests first (T009–T011), then implementation (T012–T018)
- **Phase 4 (US2)**: Depends on Phase 2; can start in parallel with Phase 3 after Phase 2 done
- **Phase 5 (Polish)**: Depends on Phase 3 + Phase 4 completion

### Within Phase 3 (US1)

1. T009, T010, T011 [P] — write all tests first (parallel, different files)
2. T012, T013, T014 [P-after-tests] — core implementation (parallel, different files)
3. T015 — mount overlay (depends on T013)
4. T016 — backend relay (parallel with frontend, different codebase)
5. T017, T018 — cleanup handlers (depend on T012/T013)

### Within Phase 4 (US2)

1. T019 — write test first
2. T020 [P] — implement panel (can parallel with T019 if TDD is relaxed)
3. T021 — mount panel (depends on T020)

### Parallel Opportunities

```
Phase 1: T001, T002 [P], T003 [P] — all parallel (different files)
Phase 2: T004, T005 can run parallel (both backend); T006, T007, T008 parallel (socket-client extensions)
Phase 3 tests: T009, T010, T011 — parallel (different test files)
Phase 3 impl: T012 (socket-client), T013 (CursorOverlay), T016 (backend) — parallel (different files)
Phase 4: T019 (test), T020 (component) — parallel after Phase 2
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (T001–T003)
2. Phase 2: Foundational (T004–T008)
3. Phase 3 Tests: T009, T010, T011 — write and confirm failing
4. Phase 3 Impl: T012–T018 — implement until tests pass
5. **STOP and VALIDATE**: Two-tab cursor test per quickstart.md Scenario 1–4

### Incremental Delivery

- After Phase 3: Live cursors work ✅
- Add Phase 4: Online user list ✅
- Phase 5: Polish and verify all AC coverage

---

## Notes

- [P] tasks = different files, no shared mutable state — safe to parallelize
- Tests use `@covers AC-n` comment tag; `check-ac-coverage.sh` reads these to enforce coverage
- `LOCAL_PRESENCE` is a module-level const — not reactive; do not put it in Zustand store
- Server never stores cursor position — only `Presence` metadata (name, color, sessionId) is persisted per room
- `CursorOverlay` must have `pointer-events: none` at the root div level
- `worldToScreen` and `screenToWorld` from `frontend/src/utils/camera.ts` are the only coordinate conversion utilities — no custom math
