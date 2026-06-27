# Research Notes — Room Join & Share Link

**Date**: 2026-06-27

## UUID Generation

**Decision**: `crypto.randomUUID()`
**Rationale**: Built-in Web Crypto API. Available Chrome 92+, Firefox 95+, Safari 15.4+, Node.js 14.17+. No npm dependency.
**Alternatives considered**: `uuid` package — rejected (unnecessary dep).

## Socket.IO Room Membership (v4.x)

**Decision**: `socket.join(roomId)` + `socket.to(roomId).emit(event, data)`
**Key APIs**:
- `socket.join(roomId)` — synchronous in v4; adds socket to named room.
- `socket.to(roomId).emit(event, data)` — broadcasts to all in room **except** sender.
- `io.to(roomId).emit(event, data)` — broadcasts to all in room **including** sender (not used here).
- `socket.leave(roomId)` — called automatically on disconnect.
**Alternatives considered**: Manual room `Map<string, Set<string>>` — rejected (Socket.IO's built-in is simpler and battle-tested).

## Socket.IO Client Lifecycle

**Decision**: Module-level singleton in `socket-client.ts`, mirroring `broadcast-channel.ts`.
- `initSocketClient(roomId)` creates connection and wires hooks.
- `stopSocketClient()` tears down.
- No React context needed.

## URL Routing

**Decision** (user-confirmed): `?room=<uuid>` query-string.
- Read: `new URLSearchParams(window.location.search).get('room')`
- Write: `window.history.pushState({}, '', '/?room=' + id)`

## WS_EVENTS (already in @vdt/shared)

`JOIN_ROOM = 'join-room'`, `ELEMENT_UPDATE = 'element-update'` already exported.
No changes to shared package needed.
