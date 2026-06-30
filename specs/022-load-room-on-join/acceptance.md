# Acceptance Criteria Registry: Load Room on Join

**Feature**: [P3A-02] Load khi mở phòng
**Spec**: [spec.md](./spec.md)
**Created**: 2026-06-29
**Status**: Frozen (append-only after ratification)

---

## Criteria

### AC-1 — DB load on join (cold room)

**Source**: User Story 1, Acceptance Scenario 1

**Criterion**: Given a room has persisted records in the database and its in-memory state is empty,
when a client joins the room, then the server loads all active records from the database into the
in-memory room state and sends `ROOM_SNAPSHOT { elements, documentClock }` where `elements`
contains all active records and `documentClock` equals the stored room clock.

**Tags**: `backend`, `P1`

---

### AC-2 — In-memory hot path (warm room)

**Source**: User Story 1, Acceptance Scenario 2

**Criterion**: Given a room already has its elements loaded in memory, when a new client joins, the
server sends `ROOM_SNAPSHOT { elements, documentClock }` from the in-memory state without issuing a
database query for the room elements.

**Tags**: `backend`, `P1`

---

### AC-3 — Empty room (no DB data)

**Source**: User Story 2, Acceptance Scenario 1

**Criterion**: Given a room does not exist in the database, when a client joins, the server sends
`ROOM_SNAPSHOT { elements: [], documentClock: 0 }`.

**Tags**: `backend`, `P1`

---

### AC-4 — Client applies snapshot via applyRemoteElements

**Source**: User Story 3, Acceptance Scenario 1

**Criterion**: Given the client receives `ROOM_SNAPSHOT { elements, documentClock }` with a
non-empty elements array, when the payload is processed, `applyRemoteElements` is called with the
received elements and `lastServerClock` is updated to the received `documentClock` value.

**Tags**: `frontend`, `P1`

---

### AC-5 — Client handles empty snapshot

**Source**: User Story 3, Acceptance Scenario 2

**Criterion**: Given the client receives `ROOM_SNAPSHOT { elements: [], documentClock: 0 }`, when
the payload is processed, the element store is not modified and `lastServerClock` is set to `0`.

**Tags**: `frontend`, `P1`

---

### AC-6 — All records deleted (tombstones only)

**Source**: Edge Cases

**Criterion**: Given a room has records in the database but all are tombstoned (deleted), when a
client joins, the server sends `ROOM_SNAPSHOT { elements: [], documentClock: N }` where `N` is the
current room clock (greater than 0).

**Tags**: `backend`, `P2`

---

### AC-7 — Database error on join is non-fatal

**Source**: Edge Cases

**Criterion**: Given the database query fails during a room join, when the server handles the
error, the server logs the error and still sends a `ROOM_SNAPSHOT` using whatever in-memory state
exists (possibly empty), without crashing the socket connection.

**Tags**: `backend`, `P2`

---

### AC-8 — documentClock is number in socket payload

**Source**: FR-002, FR-003

**Criterion**: Given the server sends `ROOM_SNAPSHOT`, the `documentClock` field in the payload is
a JavaScript `number` (not a `BigInt` or string), regardless of how the value is stored internally
in the database.

**Tags**: `backend`, `P1`
