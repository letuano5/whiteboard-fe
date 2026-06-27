# Tasks: Room Join & Share Link

**Input**: Design documents from `specs/013-room-join-share-link/`

**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/socket-events.md ✅

**Tests**: Included (TDD — one task per AC-n, tagged @covers AC-n, expected values from acceptance.md).

**Organization**: Grouped by user story. Backend foundational first, then frontend routing, socket, share link.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

**Purpose**: No new project scaffolding needed — monorepo already configured. This phase is a no-op; `pnpm install` and `pnpm dev:all` already work.

*(No tasks — project structure is in place.)*

---

## Phase 2: Foundational — Backend Room Support

**Purpose**: Server-side room handling MUST be in place before any frontend socket work can be tested end-to-end.

**⚠️ CRITICAL**: AC-5 and AC-6 (room broadcast isolation) require this phase to be complete.

- [ ] T001 Update `backend/src/index.ts`: import `WS_EVENTS` from `@vdt/shared`; on `join-room` event call `socket.join(payload.roomId)`; on `element-update` event call `socket.to(payload.roomId).emit(WS_EVENTS.ELEMENT_UPDATE, { elements: payload.elements })` to broadcast to room excluding sender.

**Checkpoint**: Server restarts cleanly; a socket connecting and emitting `join-room` logs correctly.

---

## Phase 3: User Story 1 + 4 — Home Screen & Routing (Priority: P1 / P2) 🎯 MVP routing

**Goal**: The app shows a home/landing screen when no `?room=` param is in the URL, and shows the canvas when a valid room param is present.

**Independent Test**: Visit `http://localhost:5173/` → home screen. Visit `http://localhost:5173/?room=test-id` → canvas.

### Tests for US1 + US4

> Write these FIRST; they must FAIL before implementation.

- [ ] T002 [P] [US1] Write test `@covers AC-1`: render `<App />` with `window.location.search = ''` → expect `<HomePage />` to be present and `<Whiteboard />` to be absent, in `frontend/src/app/__tests__/App.routing.test.tsx`. Also assert (mock `socket-client.ts`) that `initSocketClient` is NOT called when no room param is present (covers FR-010).
- [ ] T003 [P] [US1] Write test `@covers AC-3`: render `<App />` with `window.location.search = '?room=test-room-id'` → expect `<Whiteboard />` to be present and `<HomePage />` to be absent, in `frontend/src/app/__tests__/App.routing.test.tsx`
- [ ] T004 [P] [US1] Write test `@covers AC-2`: render `<HomePage />`, click "Create new room" button → expect `window.history.pushState` called with a URL matching `/?room=<uuid>`, in `frontend/src/app/__tests__/HomePage.test.tsx`

### Implementation for US1 + US4

- [ ] T005 [US1] Update `frontend/src/app/App.tsx`: read `new URLSearchParams(window.location.search).get('room')`. If non-null and non-empty → render `<Whiteboard />`. If null/empty → render `<HomePage />`. No need to export roomId — `main.tsx` reads `URLSearchParams` independently before `createRoot`.
- [ ] T006 [US1] Create `frontend/src/app/HomePage.tsx`: render a centered landing screen with an "Create new room" button. On click: generate `const id = crypto.randomUUID()`, call `window.history.pushState({}, '', '/?room=' + id)`, then `window.location.reload()` to trigger the routing branch.

**Checkpoint**: `pnpm dev` → `localhost:5173/` shows home screen; `localhost:5173/?room=abc` shows canvas.

---

## Phase 4: User Story 2 — Socket.IO Join Room (Priority: P1)

**Goal**: When a room URL is open, the client connects to the Socket.IO server, emits `join-room`, and receives `element-update` events from other clients in the same room via `applyRemoteElements`.

**Independent Test**: Open the same room URL in two tabs; draw a shape in one tab — it appears in the other.

### Tests for US2

> Write these FIRST; they must FAIL before implementation.

- [ ] T007 [P] [US2] Write test `@covers AC-4`: in `frontend/src/sync/__tests__/socket-client.test.ts`, mock `socket.io-client`, call `initSocketClient('room-123')`, assert `socket.emit` was called with `WS_EVENTS.JOIN_ROOM` and `{ roomId: 'room-123' }`.
- [ ] T008 [P] [US2] Write test `@covers AC-5` (unit-level): in the same test file, simulate `socket.on('element-update', handler)` firing with a valid `Element[]` payload → assert `applyRemoteElements` is called with those elements.

### Implementation for US2

- [ ] T009 [US2] Create `frontend/src/sync/socket-client.ts`:
  - Module-level `let _socket: ReturnType<typeof io> | null = null` and `let _unregisterHook: (() => void) | null = null`.
  - `initSocketClient(roomId: string): void`: connect via `io(import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001')`, emit `WS_EVENTS.JOIN_ROOM` with `{ roomId }`, register `WS_EVENTS.ELEMENT_UPDATE` handler that calls `applyRemoteElements(data.elements)`, register mutation hook via `registerMutationHook` that calls `socket.emit(WS_EVENTS.ELEMENT_UPDATE, { roomId, elements: e.elements })` when `!isApplyingRemote()`.
  - `stopSocketClient(): void`: calls `_unregisterHook?.()`, `_socket?.disconnect()`, sets both to null.
- [ ] T010 [US2] Update `frontend/src/main.tsx`: read `const roomId = new URLSearchParams(window.location.search).get('room') ?? ''` BEFORE `createRoot`. If non-empty, call `initSocketClient(roomId)` alongside the existing `initBroadcastChannel()` call. `App.tsx` reads the URL independently — do NOT export roomId from App.tsx.

**Checkpoint**: Two browser tabs on same room URL — drawing in one tab renders in the other within ~200 ms.

---

## Phase 5: User Story 3 — Copy Share Link (Priority: P2)

**Goal**: A button inside the canvas view copies the current room URL to the clipboard with visual feedback.

**Independent Test**: Click the share button in a room → clipboard contains `window.location.href`; button shows "Copied!" briefly.

### Tests for US3

> Write these FIRST; they must FAIL before implementation.

- [ ] T011 [P] [US3] Write test `@covers AC-7`: in `frontend/src/components/__tests__/ShareLinkButton.test.tsx`, mock `navigator.clipboard.writeText`, render `<ShareLinkButton />`, click the button → assert `navigator.clipboard.writeText` called with `window.location.href`.
- [ ] T012 [P] [US3] Write test `@covers AC-8`: same test file — after click, assert button text changes to "Copied!" (or contains a confirmation string); after `vi.advanceTimersByTime(2000)` assert it reverts to original label.

### Implementation for US3

- [ ] T013 [US3] Create `frontend/src/components/ShareLinkButton.tsx`: button with label "Copy link". On click: `navigator.clipboard.writeText(window.location.href).catch(...)`. Local `useState<boolean>(false)` for `copied` state; set to `true` on success, `setTimeout(..., 2000)` to reset. Display "Copied!" when `copied === true`, "Copy link" otherwise. Graceful fallback: if clipboard API unavailable, `window.prompt('Copy this link:', window.location.href)`.
- [ ] T014 [US3] Add `<ShareLinkButton />` to the canvas view — render it inside the toolbar or as a floating button in `frontend/src/canvas/Whiteboard.tsx` (or a toolbar component), visible only when inside a room (i.e. when a `?room=` param is present).

**Checkpoint**: Share button visible in room view; click → "Copied!" appears; paste in another tab → opens the same room.

---

## Phase 6: Tests — Acceptance Coverage (TDD)

**Purpose**: Ensure every AC-n has a passing test derived from acceptance.md (not from the implementation).

> Tests T002–T012 are written in their respective story phases above. This phase lists remaining AC-n that need additional coverage and runs the full suite.

- [ ] T015 [P] Write integration-style test `@covers AC-6` (room isolation): in `frontend/src/sync/__tests__/socket-client.test.ts`, simulate two socket instances in different rooms; confirm `applyRemoteElements` is NOT called when an `element-update` event arrives for a different room (server-side isolation is verified via quickstart.md scenario 6, not in unit tests).
- [ ] T016 Run `pnpm --filter whiteboard-fe test` and confirm all tests pass (T002–T015 green); fix any failures by correcting the implementation — never by changing the expected values.

**AC Coverage summary**:
| AC   | Test task |
|------|-----------|
| AC-1 | T002 |
| AC-2 | T004 |
| AC-3 | T003 |
| AC-4 | T007 |
| AC-5 | T008 |
| AC-6 | T015 |
| AC-7 | T011 |
| AC-8 | T012 |

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T017 [P] Run `pnpm typecheck` across all packages and fix any TypeScript errors introduced by this feature.
- [ ] T018 [P] Run `pnpm lint` on `frontend/` and `backend/` and fix any ESLint errors.
- [ ] T019 Validate end-to-end against all quickstart.md scenarios (Scenarios 1–7); confirm AC-1 through AC-8 pass manually.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Backend)**: No frontend dependency — can start immediately.
- **Phase 3 (Routing)**: No socket dependency — can start independently of Phase 2.
- **Phase 4 (Socket)**: Requires Phase 3 (routing must exist so `roomId` is passed to `initSocketClient`) AND Phase 2 (backend must handle `join-room`).
- **Phase 5 (Share link)**: Requires Phase 3 (must be inside a room view to render the button).
- **Phase 6 (Tests run)**: Requires Phase 3–5 complete.
- **Phase 7 (Polish)**: Requires all prior phases complete.

### Parallel Opportunities

```bash
# Phase 2 and Phase 3 can start simultaneously (different packages):
T001  # backend/src/index.ts
T002 + T003 + T004 + T005 + T006  # frontend routing

# Within Phase 4, test tasks can run in parallel:
T007 + T008  # both socket-client tests

# Within Phase 5, test tasks can run in parallel:
T011 + T012  # both ShareLinkButton tests

# Phase 7 typecheck and lint can run in parallel:
T017 + T018
```

---

## Implementation Strategy

### MVP (minimum to validate room isolation — AC-5 + AC-6)

1. T001 — Backend room handling
2. T005 + T006 — Frontend routing
3. T009 + T010 — Socket client wired
4. **VALIDATE**: Open two tabs on same room URL; draw in one; verify it appears in the other.

### Incremental Delivery

1. T001 → backend ready
2. T005–T006 → routing works (home vs canvas)
3. T009–T010 → realtime broadcast works
4. T013–T014 → share link works
5. T002–T015 → all tests green
6. T017–T019 → polish

---

## Notes

- `[P]` tasks = operate on different files, safe to parallelize.
- `[Story]` label maps each task to its acceptance criteria.
- Tests T002–T015 use expected values from `acceptance.md` — never from running the implementation.
- `crypto.randomUUID()` is built-in; no extra npm packages needed.
- `WS_EVENTS` constants (`JOIN_ROOM`, `ELEMENT_UPDATE`) already in `@vdt/shared` — no shared-package changes required.
