# WebSocket Contract: ROOM_DIFF

## Event: `room-diff`

Direction: **Server → Client** (point-to-point, `socket.emit`)

Triggered when a reconnecting client sends `JOIN_ROOM` with `lastServerClock > 0` and the
server determines its tombstone history is sufficient for an incremental diff.

### Payload

```ts
{
  changed: Element[];              // Elements modified after lastServerClock (may be empty)
  deleted: Array<{ id: string }>; // IDs tombstoned after lastServerClock (may be empty)
  documentClock: number;           // Current room documentClock (JS number, not BigInt)
}
```

### Client handler contract

1. Call `applyRemoteElements(changed)` — LWW upsert of all changed elements.
2. Call `useElementsStore.getState().removeElements(deleted.map(d => d.id))` — hard-remove tombstoned IDs.
3. Update `_lastServerClock = documentClock`.
4. Emit one `ELEMENT_UPDATE` for the contents of `_pendingQueue` if non-empty, then clear the queue.

The server MUST handle that replayed `ELEMENT_UPDATE` with the shared whole-element LWW comparator
from `@vdt/shared`. Only accepted elements are broadcast/persisted; fully discarded batches do not
advance `documentClock`.

---

## Extended Event: `join-room` (existing)

Direction: **Client → Server**

### New optional field

| Field | Type | Notes |
|-------|------|-------|
| `lastServerClock` | `number` | Present on reconnect; absent or `0` for initial join |

### Server routing logic

```
if lastServerClock is absent OR lastServerClock === 0:
  → existing initial-join path → emit ROOM_SNAPSHOT

else:
  compute tombstoneHistoryStartsAtClock = MIN(tombstone.deletedClock) for room
                                          (or +∞ if no tombstones)
  if lastServerClock >= tombstoneHistoryStartsAtClock:
    emit ROOM_DIFF  { changed, deleted, documentClock }
  else:
    emit ROOM_SNAPSHOT  { elements: <full snapshot>, documentClock }  (wipe-all)
```
