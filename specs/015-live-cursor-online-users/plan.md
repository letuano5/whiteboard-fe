# Implementation Plan: Live Cursor & Online Users

**Branch**: `feat/online-room` | **Date**: 2026-06-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/015-live-cursor-online-users/spec.md`

**Note**: Covers P2-06 (live cursor + name/color) and P2-07 (online user list).

## Summary

Add real-time cursor presence and online user visibility to the collaborative whiteboard. Each connected session gets a random name + color. Mouse movements are throttled (~33 ms) and transmitted as world-coordinate positions via Socket.IO. Remote cursors render as an overlay layer above the SVG canvas (pointer-events: none). An online users panel in the top-right corner lists all connected sessions, updating on join/leave events.

## Technical Context

**Language/Version**: TypeScript 6 / Node.js 22 LTS

**Primary Dependencies**: React 19, Zustand 5, Socket.IO 4.8.x (client + server), Tailwind CSS 4

**Storage**: In-memory only — server holds `Map<roomId, Map<socketId, Presence>>`; no DB writes.

**Testing**: Vitest 4.x — frontend unit tests in `frontend/src/sync/__tests__/` and `frontend/src/components/__tests__/`

**Target Platform**: Web (Vite SPA) + Node server

**Project Type**: Web application (monorepo: `frontend/` + `backend/`)

**Performance Goals**: Cursor update latency < ~100 ms LAN; online-list update < ~200 ms

**Constraints**: Cursor data is ephemeral — never enters `elements.store` or localStorage. Cursor events throttled to ≤ 30/sec per user.

**Scale/Scope**: ~10–50 concurrent users per room (SPECS.md §14).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Unified Element Store — renderer holds no state | ✅ | Cursor data goes into `interaction.store` (transient), not `elements.store`. |
| II | Element Versioning — `version++`, new `versionNonce`, `updatedAt` on every mutate | ✅ | Cursors are not elements; versioning is irrelevant to this feature. |
| III | Shared Camera Transform — all layers use `camera.store.ts` + `screenToWorld`/`worldToScreen` | ✅ | Cursor overlay uses `worldToScreen()` from `camera.store` to position indicators. |
| IV | ShapeUtil Strategy — no type branching in core; new shape = new ShapeUtil only | ✅ | No new element types introduced. |
| V | Sync Data Not Renderer — only `Element[]` crosses boundaries | ✅ | Cursor events carry `Presence` (not Element); they are explicitly ephemeral per spec/constitution. |
| VI | Single Mutation Pipeline — `createElement`/`patchElement`/`deleteElements`/`updateElements` only | ✅ | Cursor events bypass the mutation pipeline (they are not mutations). |
| VII | Committed vs Transient State — `elements.store` and `interaction.store` stay separate | ✅ | `remoteCursors: Map<string, Presence>` lives in `interaction.store`; never touches `elements.store`. |

No violations. No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/015-live-cursor-online-users/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── websocket.md
├── acceptance.md        # AC registry (conductor-owned)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (speckit-tasks)
```

### Source Code

```text
backend/
└── src/
    └── index.ts                      # Add USER_JOIN, USER_LEAVE, CURSOR_MOVE handlers + roomPresence map

frontend/
└── src/
    ├── sync/
    │   ├── socket-client.ts           # Extend: emit cursor-move; handle user-join/leave/cursor-move
    │   └── presence.ts               # NEW: generateSessionIdentity() → { name, color, sessionId }
    ├── canvas/
    │   ├── Whiteboard.tsx             # Add: useCursorBroadcast hook wiring + CursorOverlay
    │   └── layers/
    │       └── CursorOverlay.tsx      # NEW: renders all remote cursors
    └── components/
        └── ui/
            └── OnlineUsersPanel.tsx   # NEW: top-right panel listing name+color badges
```

## Implementation Design

### Backend (`backend/src/index.ts`)

Add in-memory presence store:
```ts
const roomPresence = new Map<string, Map<string, Presence>>();
```

**On `JOIN_ROOM`** (extend existing handler):
1. Store joining session's presence (`{ sessionId, name, color, cursor: null, selectedIds: [], status: 'active' }`) in `roomPresence.get(roomId)`.
2. Emit `USER_JOIN` to the **entire room** (including sender) with `{ roomId, presences: [...roomPresence.get(roomId).values()] }` so the new joiner also sees who is already present.

**On `CURSOR_MOVE`** (relay only — no storage):
- Relay `{ sessionId, cursor: {x, y} }` to the rest of the room. Server does NOT store cursor position.

**On `disconnect`**:
1. Identify all rooms the socket was in (iterate `socket.rooms`).
2. Remove the socket's presence from `roomPresence[roomId]`.
3. Emit `USER_LEAVE` with `{ sessionId: socket.data.sessionId }` to the room.

Store `socket.data.sessionId` and `socket.data.roomId` when handling `JOIN_ROOM`.

### Frontend — session identity (`frontend/src/sync/presence.ts`)

```ts
export interface LocalPresence { sessionId: string; name: string; color: string; }
export function generateSessionIdentity(): LocalPresence
```

- `sessionId`: `crypto.randomUUID()`
- `name`: cycle through a short name list (e.g. animal adjective pairs)
- `color`: pick from a 10-color palette of visually distinct hex values

Called once at module level; exported as `LOCAL_PRESENCE` const so identity is stable for the tab lifetime.

### Frontend — `socket-client.ts` extensions

`initSocketClient(roomId)` sends the session identity in the `JOIN_ROOM` payload:
```ts
socket.emit(WS_EVENTS.JOIN_ROOM, { roomId, sessionId, name, color });
```

New event handlers in `initSocketClient`:
- **`USER_JOIN`** → receive `presences: Presence[]` → merge into `interaction.store.remoteCursors` (skip own sessionId)
- **`USER_LEAVE`** → receive `{ sessionId }` → delete from `remoteCursors`
- **`CURSOR_MOVE`** → receive `{ sessionId, cursor }` → patch cursor position in matching presence entry

### Frontend — cursor broadcasting (Whiteboard.tsx)

Add a `lastCursorSent` ref (initially 0). Extend the existing `handlePointerMove`:
```ts
const now = Date.now();
if (now - lastCursorSent.current >= 33) {
  const worldPt = screenToWorld(local.x, local.y, camera);
  emitCursorMove(worldPt);   // new function exported from socket-client.ts
  lastCursorSent.current = now;
}
```

### Frontend — `CursorOverlay.tsx`

```tsx
// Full-size absolute div, pointer-events: none, zIndex above SVG layer
// Reads remoteCursors from interaction.store + camera from camera.store
// For each presence with cursor != null:
//   compute screenPt = worldToScreen(cursor.x, cursor.y, camera)
//   render <div style={{ left: screenPt.x, top: screenPt.y }}>
//     <svg cursor arrow in presence.color>
//     <span name label in presence.color>
//   </div>
```

### Frontend — `OnlineUsersPanel.tsx`

```tsx
// Absolute div: top-right corner (above ShareLinkButton, or stacked vertically)
// Reads remoteCursors from interaction.store
// Also reads localPresence from presence.ts to show self at top
// Each row: colored circle + name text
// Self row is always first, labeled "(you)"
```

## Data Flow

```
[Mouse move] → throttle 33ms → screenToWorld → emitCursorMove {sessionId, cursor}
    → Server relay CURSOR_MOVE → peers update remoteCursors → CursorOverlay repositions

[Tab opens] → generateSessionIdentity() → JOIN_ROOM {roomId, sessionId, name, color}
    → Server stores presence, emits USER_JOIN {presences: all} to room
    → All clients receive USER_JOIN → merge into remoteCursors (skip self)
    → OnlineUsersPanel re-renders

[Tab closes] → disconnect → Server removes, emits USER_LEAVE {sessionId}
    → Clients receive USER_LEAVE → delete from remoteCursors
    → Cursor disappears, user removed from panel
```
