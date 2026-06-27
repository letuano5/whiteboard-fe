# WebSocket Contract: Presence & Cursor Events

Extends existing Socket.IO contract in `backend/src/index.ts`.

## Existing events (unchanged)

- `join-room` (client→server): `{ roomId: string }` — now extended with presence fields below
- `element-update` (bidirectional): unchanged

## New / extended events

### `join-room` (client→server) — extended payload

```json
{
  "roomId": "uuid-v4",
  "sessionId": "uuid-v4",
  "name": "Blue Fox",
  "color": "#3b82f6"
}
```

Server stores `{ sessionId, name, color, cursor: null, selectedIds: [], status: 'active' }` in `roomPresence`.

### `user-join` (server→client, broadcast to whole room)

Emitted whenever any client joins the room (to the entire room, including sender). The full presence list lets all existing clients add the new member AND lets the new client bootstrap everyone who was already there. No `roomId` in payload — clients already know which room they're in from context.

```json
{
  "presences": [
    { "sessionId": "...", "name": "Blue Fox", "color": "#3b82f6", "cursor": null, "selectedIds": [], "status": "active" },
    { "sessionId": "...", "name": "Red Bear", "color": "#ef4444", "cursor": null, "selectedIds": [], "status": "active" }
  ]
}
```

### `user-leave` (server→client, broadcast to room)

Emitted when a client disconnects. Clients remove the identified session from their presence map.

```json
{ "sessionId": "uuid-v4" }
```

### `cursor-move` (client→server)

Client sends throttled cursor position in world coordinates.

```json
{
  "roomId": "uuid-v4",
  "sessionId": "uuid-v4",
  "cursor": { "x": 1234.5, "y": 678.9 }
}
```

### `cursor-move` (server→client, relay to room except sender)

```json
{
  "sessionId": "uuid-v4",
  "cursor": { "x": 1234.5, "y": 678.9 }
}
```

## Constants (from `@vdt/shared`)

```ts
WS_EVENTS.CURSOR_MOVE  = 'cursor-move'
WS_EVENTS.USER_JOIN    = 'user-join'
WS_EVENTS.USER_LEAVE   = 'user-leave'
```
