# Data Model: PostgreSQL Prisma Autosave

## Room

Represents a collaborative room with durable clock metadata.

| Field | Type | Rules |
|-------|------|-------|
| `id` | UUID string | Primary key. Created on first save if missing. |
| `name` | string | Defaults to `Untitled`. |
| `ownerId` | string nullable | Reserved for P3B auth. |
| `documentClock` | bigint | Starts at 0. Incremented exactly once per non-empty write transaction. |
| `tombstoneHistoryStartsAtClock` | bigint | Starts at 0. Used by later reconnect/delta features. |
| `createdAt` | datetime | Set on create. |
| `updatedAt` | datetime | Updated by Prisma on changes. |

## RoomMember

Schema-ready membership row for future auth/permission.

| Field | Type | Rules |
|-------|------|-------|
| `roomId` | UUID string | Part of composite primary key, cascades on room delete. |
| `userId` | string | Part of composite primary key. |
| `role` | string | Expected values: `owner`, `editor`, `viewer`. Not used by P3A-01 runtime. |

## Record

One active, non-deleted element in a room.

| Field | Type | Rules |
|-------|------|-------|
| `roomId` | UUID string | Part of composite primary key, cascades on room delete. |
| `recordId` | string | Element id. Part of composite primary key. |
| `typeName` | string | Element type, copied from `Element.type`. |
| `state` | JSON | Full shared `Element` object. Must have `isDeleted = false`. |
| `recordClock` | bigint | Equal to the transaction's new room `documentClock`. |

Indexes:
- `(roomId, recordClock)` for later delta loading.

## Tombstone

One deleted element marker in a room.

| Field | Type | Rules |
|-------|------|-------|
| `roomId` | UUID string | Part of composite primary key, cascades on room delete. |
| `recordId` | string | Deleted element id. Part of composite primary key. |
| `deletedClock` | bigint | Equal to the transaction's new room `documentClock`. |

Indexes:
- `(roomId, deletedClock)` for later delta loading.

## Runtime Entity: Pending Autosave Room

In-memory state only.

| Field | Type | Rules |
|-------|------|-------|
| `dirtyRooms` | Set<string> | Room ids with unsaved changes. |
| `timers` | Map<string, Timeout> | One scheduled flush per dirty room. |
| `inFlight` | Set<string> | Prevents overlapping flushes for the same room. |

## State Transitions

```text
clean -> markDirty(roomId) -> dirty + scheduled
dirty + scheduled -> flush success -> clean
dirty + scheduled -> flush failure -> dirty
dirty + scheduled -> room empty -> clear timer + immediate flush
dirty + inFlight -> additional markDirty -> remains dirty and schedules retry after in-flight flush
```
