# WebSocket Event Contracts (P2.5-04)

All events are Socket.IO events. Direction: C→S = client to server; S→C = server to client (broadcast to room peers).

---

## Modified: `cursor-move`

**Direction**: C→S then S→C (relay)

**Change**: Add optional `selectedIds` field to both outgoing and relayed payloads.

### Client → Server
```jsonc
{
  "roomId": "uuid-string",
  "sessionId": "uuid-string",
  "cursor": { "x": 120.5, "y": 88.3 },       // null for viewport-only
  "viewport": { "x": 0, "y": 0, "zoom": 1 }, // optional
  "selectedIds": ["elem-id-1", "elem-id-2"]   // optional; omit if unchanged
}
```

### Server → Client (relay)
```jsonc
{
  "sessionId": "uuid-string",
  "cursor": { "x": 120.5, "y": 88.3 },
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "selectedIds": ["elem-id-1", "elem-id-2"]   // present if sender included it
}
```

**Backward compatibility**: Both `viewport` and `selectedIds` are optional. Clients not implementing P2.5-04 will ignore the new field; clients implementing it will process it. The server relay is a pass-through — no breaking change.

---

## New: `element-draft`

**Direction**: C→S then S→C (relay, no server storage)

**Purpose**: Broadcast in-progress (transient) element state while the user is dragging, resizing, or drawing. Receivers display these as ghost previews, never writing to committed state.

### Client → Server
```jsonc
{
  "roomId": "uuid-string",
  "sessionId": "uuid-string",
  "elements": [
    {
      "id": "elem-id-1",
      "type": "rectangle",
      "x": 200, "y": 150, "width": 100, "height": 80,
      "angle": 0,
      "zIndex": 3,
      "version": 5,
      "versionNonce": 123456789,
      "updatedAt": 1719532800000,
      "isDeleted": false,
      "props": { "fill": "#3b82f6", "stroke": "#1d4ed8", "strokeWidth": 2 }
    }
  ]
}
```

**Clear signal**: `"elements": []` — instructs receivers to clear the draft for this `sessionId` (cancellation or commit).

### Server → Client (relay)
```jsonc
{
  "sessionId": "uuid-string",
  "elements": [ /* same Element[] as above, or [] for clear */ ]
}
```

**Server behavior**: Pure relay. The server MUST NOT store `element-draft` payloads in `roomElements`. It relays to all peers in `roomId` except the sender.

**Throttle**: Sender MUST throttle emission to ≤ 50 ms intervals (20 updates/sec max).
