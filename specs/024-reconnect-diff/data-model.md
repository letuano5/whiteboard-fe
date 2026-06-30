# Data Model: Reconnect Without Data Loss (P3A-03)

## New / Modified Types

### `WS_EVENTS.ROOM_DIFF` (new constant — `@vdt/shared`)

Added to the `WS_EVENTS` object in `packages/shared/src/index.ts`:

```ts
ROOM_DIFF: 'room-diff'
```

### `JOIN_ROOM` payload (extended — `@vdt/shared` / backend)

The existing JOIN_ROOM payload gains one optional field:

| Field | Type | Description |
|-------|------|-------------|
| `roomId` | `string` | Unchanged |
| `sessionId` | `string` | Unchanged |
| `name` | `string` | Unchanged |
| `color` | `string` | Unchanged |
| `lastServerClock` | `number` (optional) | Last documentClock received by this client; 0 or absent → initial join |

### `ROOM_DIFF` payload (new — server → client)

Emitted by the server when reconnect diff is possible:

| Field | Type | Description |
|-------|------|-------------|
| `changed` | `Element[]` | Elements added or updated since `lastServerClock` |
| `deleted` | `Array<{ id: string }>` | Element IDs that were tombstoned since `lastServerClock` |
| `documentClock` | `number` | Current room clock at the time of the diff (converted from BigInt at DB boundary) |

### `RoomDiffResult` (internal — `backend/src/persistence/room-repository.ts`)

Internal return type of `getRoomDiff`:

```ts
type RoomDiffResult =
  | { mode: 'diff'; changed: Element[]; deleted: Array<{ id: string }>; documentClock: number }
  | { mode: 'wipe'; elements: Element[]; documentClock: number };
```

## DB Schema — No Changes

`Record.recordClock` and `Tombstone.deletedClock` are already present and indexed
(see `backend/prisma/schema.prisma`). `Room.tombstoneHistoryStartsAtClock` exists but
is unused in P3A (computed dynamically from tombstones).

## Client-Side State (module-level in `socket-client.ts`)

| Variable | Type | Description |
|----------|------|-------------|
| `_lastServerClock` | `number` | Already exists; also updated on ROOM_DIFF |
| `_pendingQueue` | `Element[]` | New; holds mutations made while socket is disconnected |
| `_hasJoined` | `boolean` | New; tracks whether JOIN_ROOM has been sent at least once |
