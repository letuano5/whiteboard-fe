# Data Model: Delta Push theo Clock

**Feature**: P3A-04  
**Date**: 2026-06-29

## In-memory State (Backend)

### `roomClocks: Map<roomId, number>`

New module-level map in `backend/src/index.ts`, parallel to the existing `elements` map.

| Field | Type | Description |
|-------|------|-------------|
| key | `string` (roomId) | UUID of the room |
| value | `number` | Current in-memory `documentClock` for the room |

**Lifecycle**:
- **Initialised** on first client join (cold path): value = `loaded.documentClock` from `loadRoomElements`.
- **Skipped** on subsequent joins (warm path): map entry already exists and is current.
- **Backfilled** on warm joins or first updates if missing: value = `getRoomClock(db, roomId)` or 0 for a new room.
- **Incremented** by 1 on every `ELEMENT_UPDATE` received.
- **Retained** with `roomElements` after the last client leaves; both are process-local hot state until server restart.

## Persistence Clock Flow

### `targetDocumentClock`

Autosave receives the current in-memory clock for the room and passes it to the repository.

```
saveRoomElements(roomId, elements, targetDocumentClock)
```

The repository persists `Room.documentClock`, `Record.recordClock`, and
`Tombstone.deletedClock` using the target clock for that flush. If the database already has
a higher clock, the repository must not decrease it.

## WebSocket Payload Changes

### `ELEMENT_UPDATE` broadcast (server → peers)

**Before (P3A-03 and earlier)**:
```
{ elements: Element[]; sessionId?: string }
```

**After (P3A-04)**:
```
{ elements: Element[]; sessionId?: string; documentClock: number }
```

The added `documentClock` field carries the current in-memory room clock after the increment.

### `ELEMENT_UPDATE` emit (client → server)

No change to the payload sent by the client. The server derives the clock internally.

### `ROOM_SNAPSHOT` (server → joiner)

No change — already carries `documentClock`. Clients already set `lastServerClock` from this event.

## Frontend State

### `_lastServerClock` (module-level, `socket-client.ts`)

No structural change. Existing variable and `getLastServerClock()` accessor are reused.

**Updated trigger**: Now also set when `ELEMENT_UPDATE` is received and the payload contains `documentClock`.

| Event | Before | After |
|-------|--------|-------|
| `ROOM_SNAPSHOT` | Updated ✓ | Updated ✓ |
| `ELEMENT_UPDATE` (from peer) | **Not updated** | **Updated ✓** |

## Entities (no schema changes)

No database schema changes. The `Room.documentClock` column already exists (introduced in P3A-01). The `Record.recordClock` column already exists. No migrations required for P3A-04.
