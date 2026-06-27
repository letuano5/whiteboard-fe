# Socket.IO Event Contracts — Room Join & Share Link

## Events

### `join-room` (client → server)

Emitted by the client immediately after socket connection to register in a room.

```ts
// Payload
{ roomId: string }  // UUID v4 identifying the room

// WS_EVENTS constant: WS_EVENTS.JOIN_ROOM = 'join-room'
```

**Server behaviour**: calls `socket.join(roomId)`.

---

### `element-update` (client → server → other clients in room)

Emitted by a client after one or more element mutations.

```ts
// Payload (client → server)
{ roomId: string; elements: Element[] }

// WS_EVENTS constant: WS_EVENTS.ELEMENT_UPDATE = 'element-update'
```

**Server behaviour**: re-emits `{ elements }` to `socket.to(roomId)` (all room members except sender).

```ts
// Payload (server → client)
{ elements: Element[] }
```

**Client handler**: calls `applyRemoteElements(elements)` (LWW — same function as BroadcastChannel).

---

## Notes

- `roomId` is a UUID v4 string — URL-safe, no encoding required.
- Only `Element[]` data crosses the socket (Constitution Principle V).
- Presence/cursor events (`cursor-move`, `user-join`, `user-leave`) are separate events defined in Phase 2 (P2-06/P2-07) and not in scope for P2-01.
