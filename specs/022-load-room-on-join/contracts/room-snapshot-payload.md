# Contract: ROOM_SNAPSHOT Payload

**Event**: `room-snapshot` (Socket.IO, server → client)
**Changed in**: P3A-02

---

## Before P3A-02

```json
{
  "elements": [/* Element[] */]
}
```

`documentClock` was absent; clients applied the snapshot via `setElements` (direct store
replacement, bypassing the mutation pipeline).

---

## After P3A-02

```json
{
  "elements": [/* Element[] */],
  "documentClock": 42
}
```

| Field           | Type       | Description                                                              |
|-----------------|------------|--------------------------------------------------------------------------|
| `elements`      | `Element[]`| Active (non-deleted) elements for the room at the moment of join.        |
| `documentClock` | `number`   | Current room clock from the server; `0` if the room has no DB record.    |

### Invariants

- `documentClock` is always present (never `undefined`).
- `documentClock >= 0`.
- If `elements` is empty, `documentClock` may be `0` (new room) or `> 0` (all elements deleted).
- All `Element` objects in `elements` have `isDeleted === false`.

### Client handling

1. Store `documentClock` as `lastServerClock` (module-level in `socket-client.ts`).
2. Pass `elements` to `applyRemoteElements` for conflict-safe application.

### Server emission point

Emitted once per joining client immediately after presence registration, before `USER_JOIN`
broadcast. Emission order:
1. `ROOM_SNAPSHOT` → to joining client only (`socket.emit`)
2. `USER_JOIN` → to entire room including joiner (`ioServer.to(roomId).emit`)
