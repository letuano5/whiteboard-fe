# Implementation Plan: Room Join & Share Link

**Branch**: `feat/online-room` | **Date**: 2026-06-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/013-room-join-share-link/spec.md`

## Summary

Add room-based routing and real-time Socket.IO connectivity so multiple clients can join
the same whiteboard room and receive each other's element changes. The URL pattern
`/?room=<uuid>` gates access: no room param → home/landing screen with a "Create room"
button; valid room param → canvas with an active Socket.IO connection that joins that room.
Element mutations are broadcast to all other room members via `element-update` using
the existing `applyRemoteElements` LWW function (same path as BroadcastChannel). The
share-link button copies the current URL to clipboard with brief visual feedback.

## Technical Context

**Language/Version**: TypeScript 6.x (frontend), TypeScript 5.8.x (backend), Node.js 22.x LTS

**Primary Dependencies**:
- Frontend: React 19, Zustand 5, socket.io-client 4.8.x (already installed), Vite 8
- Backend: Express 5, socket.io 4.8.x (already installed)
- Shared: `@vdt/shared` workspace link — `WS_EVENTS` (`JOIN_ROOM`, `ELEMENT_UPDATE`) already defined

**Storage**: localStorage (P1, unchanged) — no server-side persistence this phase

**Testing**: Vitest 4.x (frontend unit tests)

**Target Platform**: Modern browser + Node.js 22 server

**Project Type**: Web application (monorepo: frontend + backend + shared)

**Performance Goals**: Element changes delivered to all room members in < 200 ms on LAN

**Constraints**:
- No new npm dependencies — `crypto.randomUUID()` used for room ID generation (built-in)
- No database — rooms are in-memory `Map<string, Set<string>>` on the server
- Only `Element[]` crosses the socket (Principle V)
- Socket emitter registered via `registerMutationHook` (Principle VI)

**Scale/Scope**: ~10–50 simultaneous users per room per SPECS.md §14

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Unified Element Store — renderer holds no state | ✅ | Socket client has no element state; only `useElementsStore` holds elements |
| II | Element Versioning — `version++`, new `versionNonce`, `updatedAt` on every mutate | ✅ | Mutations go through pipeline which already handles versioning; incoming elements via `applyRemoteElements` use LWW |
| III | Shared Camera Transform — all layers use `camera.store.ts` | ✅ | Not touched by this feature |
| IV | ShapeUtil Strategy — no type branching in core | ✅ | Not touched by this feature |
| V | Sync Data Not Renderer — only `Element[]` crosses boundaries | ✅ | Socket payload is `{ elements: Element[] }` only |
| VI | Single Mutation Pipeline — broadcast wired via `registerMutationHook` | ✅ | `socket-client.ts` registers a hook exactly like `broadcast-channel.ts` |
| VII | Committed vs Transient State — `elements.store` and `interaction.store` stay separate | ✅ | Socket client lives in `sync/`, not in any store |

No violations. Constitution Check passes.

## Project Structure

### Documentation (this feature)

```text
specs/013-room-join-share-link/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── socket-events.md
└── tasks.md             # Phase 2 output (speckit-tasks)
```

### Source Code

```text
packages/shared/src/
└── index.ts             ← no changes needed (WS_EVENTS already has JOIN_ROOM, ELEMENT_UPDATE)

backend/src/
└── index.ts             ← updated: join-room handler, room-scoped broadcast

frontend/src/
├── app/
│   ├── App.tsx          ← updated: query-string routing (home vs canvas)
│   └── HomePage.tsx     ← new: landing screen with "Create room" button
├── sync/
│   └── socket-client.ts ← new: Socket.IO client init, join-room emit, mutation hook, element-update handler
├── components/
│   └── ShareLinkButton.tsx  ← new: clipboard copy + visual feedback
└── main.tsx             ← updated: call initSocketClient(roomId) when in a room
```

## Complexity Tracking

> No Constitution violations — table left empty.

---

## Phase 0: Research

### Finding 1 — UUID generation

**Decision**: Use `crypto.randomUUID()` (Web Crypto API)
**Rationale**: Built into all modern browsers (Chrome 92+, Firefox 95+, Safari 15.4+) and Node.js 14.17+. No npm dependency needed.
**Alternatives considered**: `uuid` npm package — rejected (unnecessary dependency for a single call site).

### Finding 2 — Socket.IO room membership

**Decision**: Use Socket.IO built-in rooms via `socket.join(roomId)` / `socket.to(roomId).emit(event, data)`
**Rationale**: Socket.IO 4.x rooms are the canonical way to scope broadcasts. `socket.join()` is synchronous in v4.
`socket.to(roomId).emit(...)` sends to all sockets in the room *except* the sender — exactly the P2 requirement.
**Alternatives considered**: Manual room maps — rejected (duplicates Socket.IO's built-in mechanism).

### Finding 3 — Socket.IO client lifecycle

**Decision**: Single `io()` instance created once per room session, stored in a module-level variable in `socket-client.ts`.
**Rationale**: Matches the pattern of `broadcast-channel.ts` (module-level singleton). No React context needed.
Socket is connected when `initSocketClient(roomId)` is called (from `main.tsx` or App route change), and disconnected on `stopSocketClient()`.
**Alternatives considered**: React context / hook — rejected (adds indirection; the mutation hook pattern doesn't need React lifecycle).

### Finding 4 — URL routing (confirmed)

**Decision**: `?room=<uuid>` query-string, parsed with `URLSearchParams(window.location.search)`. Navigation via `window.history.pushState`.
**Rationale**: User-confirmed in Phase 1 clarification. No router library added.

### Finding 5 — WS_EVENTS (already in @vdt/shared)

`WS_EVENTS.JOIN_ROOM = 'join-room'` and `WS_EVENTS.ELEMENT_UPDATE = 'element-update'` are already exported from `packages/shared/src/index.ts`. No changes to shared types needed.

---

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](data-model.md).

### Socket Event Contracts

See [contracts/socket-events.md](contracts/socket-events.md).

### Quickstart Validation Guide

See [quickstart.md](quickstart.md).

---

## Implementation Approach (summary for tasks.md)

### Step 1 — Backend: room-scoped broadcast

`backend/src/index.ts`:
- On `join-room` event: `socket.join(payload.roomId)` — Socket.IO handles room membership.
- On `element-update` event: `socket.to(payload.roomId).emit(WS_EVENTS.ELEMENT_UPDATE, { elements })` — broadcast to room, excluding sender.
- Import `WS_EVENTS` from `@vdt/shared`.

### Step 2 — Shared types

No changes needed (WS_EVENTS already correct).

### Step 3 — Frontend routing

`main.tsx` (before `createRoot`):
- Read `const roomId = new URLSearchParams(window.location.search).get('room') ?? ''`.
- If non-empty: call `initSocketClient(roomId)` alongside existing `initBroadcastChannel()`.

`App.tsx`:
- Independently reads the same URL param: `new URLSearchParams(window.location.search).get('room')`.
- If non-null and non-empty → render `<Whiteboard />`.
- If null/empty → render `<HomePage />`.
- Note: no "export roomId from App.tsx" — both `main.tsx` and `App.tsx` read from `window.location.search` directly. This is safe because the URL does not change between module init and component render.

`HomePage.tsx`:
- "Create new room" button: calls `crypto.randomUUID()`, calls `window.history.pushState({}, '', '/?room=' + id)`, then `window.location.reload()`.
- Full page reload is intentional: it cleanly re-runs `main.tsx` (which initialises the socket) and eliminates any risk of a double-connection from a SPA re-render while the previous socket is still open.
- Minimal styling consistent with existing Tailwind setup.

### Step 4 — Socket.IO client module

`frontend/src/sync/socket-client.ts`:
- `initSocketClient(roomId: string): void` — creates `io(SERVER_URL)`, emits `join-room`, registers `element-update` handler that calls `applyRemoteElements`, registers mutation hook that emits `element-update` (skips if `isApplyingRemote()`).
- `stopSocketClient(): void` — disconnects socket, unregisters hook.
- Server URL from `import.meta.env.VITE_BACKEND_URL` with fallback to `'http://localhost:3001'`.

### Step 5 — Wire socket client in main.tsx

- `main.tsx` reads `roomId` from `URLSearchParams` BEFORE `createRoot` (see Step 3 above).
- If roomId is non-empty: call `initSocketClient(roomId)` alongside `initBroadcastChannel()`.

### Step 6 — ShareLinkButton component

`frontend/src/components/ShareLinkButton.tsx`:
- Calls `navigator.clipboard.writeText(window.location.href)`.
- Temporary "Copied!" state for ~2 seconds (local `useState` + `setTimeout`).
- Degrades gracefully if clipboard API unavailable (shows a prompt/alert as fallback).
- Rendered inside the canvas view (e.g. in a toolbar or floating corner button).
