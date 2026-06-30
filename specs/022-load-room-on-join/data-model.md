# Data Model: Load Room on Join

**Feature**: [P3A-02] Load khi mở phòng
**Date**: 2026-06-29

No new database entities or schema changes are required. P3A-02 reads from the schema
established in P3A-01.

---

## Entities Read (existing)

### Room (read-only for P3A-02)

| Field                        | Type     | Description                                      |
|------------------------------|----------|--------------------------------------------------|
| `id`                         | String   | UUID, primary key                                |
| `documentClock`              | BigInt   | Monotonically increasing clock per write batch   |
| `tombstoneHistoryStartsAtClock` | BigInt | Start of tombstone history window (P3A-03 use) |

P3A-02 reads `id` and `documentClock` only.

### Record (read-only for P3A-02)

| Field         | Type   | Description                                         |
|---------------|--------|-----------------------------------------------------|
| `roomId`      | String | Foreign key → Room.id                               |
| `recordId`    | String | Element id (`Element.id`)                           |
| `typeName`    | String | `Element.type` value                                |
| `state`       | Json   | Full `Element` object as stored by P3A-01 autosave  |
| `recordClock` | BigInt | Clock value at last upsert                          |

P3A-02 reads all `Record` rows for a room and deserializes `state` as `Element`.

---

## New Interfaces (TypeScript, not DB schema)

### LoadRoomResult

```typescript
interface LoadRoomResult {
  elements: Element[];
  documentClock: number; // converted from BigInt at repository boundary
}
```

Used as return type of `loadRoomElements(db, roomId)`.

### Updated ROOM_SNAPSHOT Payload

```typescript
// Before P3A-02 (no documentClock):
// { elements: Element[] }

// After P3A-02:
interface RoomSnapshotPayload {
  elements: Element[];
  documentClock: number;
}
```

Carried as the payload of the `'room-snapshot'` Socket.IO event.

---

## Module-level State (frontend)

### _lastServerClock (socket-client.ts)

```typescript
let _lastServerClock = 0;
```

Not a Zustand store. Updated once per `ROOM_SNAPSHOT` event. Read by P3A-03 reconnect logic
via `getLastServerClock()`. Not persisted between page loads.
