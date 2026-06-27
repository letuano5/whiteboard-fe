# Data Model — Room Join & Share Link

## No new Element types

P2-01 introduces no new `ElementType`. The `Element` interface in `@vdt/shared` is unchanged.

## Server-side room state (in-memory)

The server maintains room membership using **Socket.IO's built-in room mechanism**.
No explicit data structure is defined in application code — Socket.IO manages it internally.

Conceptually:
```
rooms: Map<roomId: string, members: Set<socketId: string>>
```

- Created implicitly on first `socket.join(roomId)`.
- Cleaned up automatically when all sockets in the room disconnect.

## RoomId

| Field    | Type     | Description                                         |
|----------|----------|-----------------------------------------------------|
| `roomId` | `string` | UUID v4, URL-safe. Lives in `?room=` query param.  |

Generated client-side via `crypto.randomUUID()`. No server-side registration required.

## Frontend routing state

Routing is derived from `window.location.search` at component mount — there is no Zustand store for the room ID. The `roomId` is a local variable passed to `initSocketClient(roomId)`.
