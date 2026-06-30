# Internal Contract: Autosave Lifecycle

P3A-01 has no public socket payload change. This contract describes the internal backend interfaces
that implementation and tests should target.

## `saveRoomElements`

```ts
type SaveRoomElements = (roomId: string, elements: Element[]) => Promise<bigint | null>;
```

Behavior:
- Returns `null` and performs no write for an empty element array.
- Creates the room when missing.
- Increments `documentClock` once for a non-empty write.
- Upserts active elements into `Record`.
- Removes active records and upserts tombstones for deleted elements.
- Clears tombstones when an active element with the same id is saved later.

## `AutosaveManager`

```ts
interface AutosaveManager {
  markDirty(roomId: string): void;
  flushRoom(roomId: string): Promise<void>;
  flushRoomNow(roomId: string): Promise<void>;
  hasPending(roomId: string): boolean;
}
```

Behavior:
- `markDirty` schedules at most one timer per room.
- `flushRoom` uses the latest elements returned by `getRoomElements(roomId)` at flush time.
- Successful flush clears dirty state.
- Failed flush logs and preserves dirty state.
- `flushRoomNow` clears any scheduled timer and starts persistence immediately.

## Socket Integration

On `element-update`:

```text
update in-memory roomElements
markDirty(roomId)
broadcast element-update to peers
```

On last-client disconnect:

```text
remove presence
if room has zero clients:
  flushRoomNow(roomId)
```
