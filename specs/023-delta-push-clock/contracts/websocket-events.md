# WebSocket Contract: Delta Push theo Clock

**Feature**: P3A-04  
**Date**: 2026-06-29

## Changed Event: `element-update`

### Client → Server (no change)

```
Event: "element-update"
Payload: {
  roomId: string;      // UUID of the room
  elements: Element[]; // batch of elements to persist and broadcast
  sessionId?: string;  // sender's session id (for draft clearing on peers)
}
```

### Server → Peers (CHANGED — adds documentClock)

```
Event: "element-update"
Payload: {
  elements: Element[];    // same elements relayed from sender
  sessionId?: string;     // sender's session id
  documentClock: number;  // NEW: in-memory room clock after increment
}
```

**Receiver contract**: On receiving this event, the client MUST:
1. Call `applyRemoteElements(data.elements)` to merge into local store.
2. If `data.documentClock` is present, set `_lastServerClock = data.documentClock`.
3. If `data.sessionId` is present, clear `remoteDrafts` for that session.

## Unchanged Events

| Event | Direction | Notes |
|-------|-----------|-------|
| `room-snapshot` | Server → Joiner | Already carries `documentClock`; no change |
| `join-room` | Client → Server | No change |
| `element-draft` | Bidirectional | Ephemeral; no clock needed |
| `cursor-move` | Bidirectional | Presence only; no clock needed |

## Invariants

1. `documentClock` in `element-update` broadcast is always > the `documentClock` in the preceding `room-snapshot` received by that client (monotonically increasing).
2. `documentClock` is never present in the `element-update` payload sent by the client to the server.
3. The sender of an `element-update` does NOT receive the clock-enriched broadcast (Socket.IO `socket.to(roomId)` excludes sender).
