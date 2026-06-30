# Feature Specification: Load Room on Join

**Feature Branch**: `feat/online-room`

**Created**: 2026-06-29

**Status**: Draft

**Input**: User description: "[P3A-02] Load khi mở phòng"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Persistent Room State After Server Restart (Priority: P1)

As a collaborator opening a room that was previously active (with saved data), I need to see all
persisted elements immediately upon joining, even if the server restarted since the last session,
so that no work is lost between sessions.

**Why this priority**: This is the primary value of P3A: making the server the durable source of
truth. Without this story, a server restart wipes all room data for subsequent joiners.

**Independent Test**: Can be tested by persisting elements in a room, restarting the backend (to
clear in-memory state), then having a new client join and verifying it receives all saved elements
with a non-zero `documentClock`.

**Acceptance Scenarios**:

1. **Given** a room has persisted records in the database and its in-memory state is empty (e.g.
   after server restart), **When** a client joins the room, **Then** the server loads records from
   the database into memory and sends `ROOM_SNAPSHOT { elements, documentClock }` where elements
   contains all active (non-deleted) records and `documentClock` matches the stored room clock.
2. **Given** a room already has its elements loaded in memory (hot path), **When** a new client
   joins the room, **Then** the server sends `ROOM_SNAPSHOT { elements, documentClock }` from the
   in-memory state without querying the database again.

---

### User Story 2 - New Empty Room (Priority: P1)

As a collaborator opening a room that has never been used, I need the board to load cleanly with
no elements and a baseline clock, so I can start fresh without confusion.

**Why this priority**: Every room starts empty; the system must handle the no-data case gracefully
without errors.

**Independent Test**: Can be tested by joining a room that does not exist in the database and
verifying the client receives `{ elements: [], documentClock: 0 }`.

**Acceptance Scenarios**:

1. **Given** a room does not exist in the database, **When** a client joins, **Then** the server
   sends `ROOM_SNAPSHOT { elements: [], documentClock: 0 }`.

---

### User Story 3 - Client Applies Snapshot and Tracks Clock (Priority: P1)

As a collaborator joining a room, I need the client to correctly apply the received snapshot
(including conflict-resolution rules) and remember the server clock value, so that later
reconnect logic can request only the changes I missed.

**Why this priority**: `lastServerClock` is required by P3A-03 (reconnect diff). Applying through
`applyRemoteElements` ensures consistency with the regular sync conflict-resolution path.

**Independent Test**: Can be tested by having the client receive a `ROOM_SNAPSHOT` and asserting
that (a) elements are applied through `applyRemoteElements`, and (b) `lastServerClock` is set to
the received `documentClock`.

**Acceptance Scenarios**:

1. **Given** the client receives `ROOM_SNAPSHOT { elements, documentClock }`, **When** the payload
   is processed, **Then** `applyRemoteElements` is called with the received elements and
   `lastServerClock` is updated to the received `documentClock`.
2. **Given** the client receives `ROOM_SNAPSHOT { elements: [], documentClock: 0 }`, **When** the
   payload is processed, **Then** the element store is not modified and `lastServerClock` is set to
   `0`.

---

### Edge Cases

- Room has records in the database but all are deleted (tombstoned only): server sends
  `{ elements: [], documentClock: N }` where `N` is the last known clock.
- Two clients join concurrently before in-memory state is populated: both trigger the DB load, but
  the result is idempotent (last-write-wins into the memory map). Automated testing of this race
  is out of scope for P3A-02; correctness follows from the last-write-wins semantics of the
  in-memory `Map.set` operation.
- Database query fails during join: server logs the error and falls back to sending whatever is
  currently in memory (potentially empty), never crashing the socket connection.
- Client receives a snapshot with elements that conflict with local state (unlikely on join but
  possible in tests): `applyRemoteElements` version/versionNonce tie-breaking applies.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The backend MUST query the database for active records when a client joins a room
  that has no in-memory elements, then populate the in-memory room state before sending the
  snapshot.
- **FR-002**: The backend MUST read the room's current `documentClock` from the database (or use
  `0` when the room does not exist) and include it in the `ROOM_SNAPSHOT` payload.
- **FR-003**: The backend MUST send `ROOM_SNAPSHOT { elements: Element[], documentClock: number }`
  to the joining client; for rooms with no DB data the payload MUST be
  `{ elements: [], documentClock: 0 }`.
- **FR-004**: The backend MUST NOT trigger a full element DB load when the room already has a
  non-empty in-memory element map (size > 0); subsequent joiners to an active room use the
  in-memory state directly to avoid redundant queries.
- **FR-005**: A database error during the room load MUST be caught and logged; the server MUST
  still send whatever in-memory state exists (possibly empty) and MUST NOT crash the socket.
- **FR-006**: The frontend MUST update `ROOM_SNAPSHOT` handling to pass received elements through
  `applyRemoteElements` instead of directly replacing the element store.
- **FR-007**: The frontend MUST store `lastServerClock` (the `documentClock` from the snapshot)
  in module-level state in `socket-client.ts`; this value is the starting clock for the P3A-03
  reconnect diff protocol.
- **FR-008**: The shared `WS_EVENTS.ROOM_SNAPSHOT` event constant MUST remain unchanged; only the
  payload type changes to add `documentClock: number`.

### Key Entities

- **Room Snapshot**: The payload sent to a joining client containing the full current element list
  and the server's `documentClock` at the moment of join.
- **lastServerClock**: Client-side module state tracking the most recent `documentClock` received
  from the server; initialized on snapshot receipt and updated on each server-clock-carrying event
  (P3A-03/P3A-04 will add further update points).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A client joining a room after a server restart receives all previously persisted
  elements within the `ROOM_SNAPSHOT`, with no manual refresh needed.
- **SC-002**: A client joining an empty (new) room receives `elements: []` and `documentClock: 0`
  without error.
- **SC-003**: All acceptance criteria AC-1 through AC-8 are covered by automated tests tagged
  with `@covers AC-n`.
- **SC-004**: A subsequent joiner in an active room does not trigger a database query (in-memory
  hot path is preserved).

## Assumptions

- P3A-01 is complete: the database schema (`Room`, `Record`, `Tombstone`), Prisma client
  singleton, and `saveRoomElements` are available and working.
- `documentClock` values fit within a JavaScript `number` at this phase; conversion from Prisma
  `BigInt` happens at the boundary when constructing the socket payload.
- `applyRemoteElements` already handles an empty array gracefully (no-op path exists).
- `lastServerClock` is only consumed by P3A-03 reconnect logic; no other frontend code reads it in
  this phase.
- No frontend UI changes are needed for this feature; the snapshot is applied silently.
- The `WS_EVENTS.ROOM_SNAPSHOT` event name remains `'room-snapshot'` (no rename).
- A new `loadRoomElements(db, roomId)` query function will be added to
  `backend/src/persistence/room-repository.ts`; it returns both `elements` and `documentClock`.
