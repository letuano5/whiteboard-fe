# Feature Specification: PostgreSQL Prisma Autosave

**Feature Branch**: `feat/online-room`

**Created**: 2026-06-29

**Status**: Draft

**Input**: User description: "Implement [P3A-01] PostgreSQL + Prisma + autosave - [BE]"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Durable room writes (Priority: P1)

As a collaborator editing a room, I need committed element changes to be saved durably so that
server restarts or later reconnect work can restore the room from persistent storage.

**Why this priority**: P3A makes the server authoritative with a durable backing store. Without
durable writes, all later load/reconnect features still lose data after process restart.

**Independent Test**: Can be tested by applying an element batch to a room, forcing an autosave,
and verifying the room clock and persisted records match the in-memory room state.

**Acceptance Scenarios**:

1. **Given** an existing room with no saved records, **When** a live element update is received and
   autosave is flushed, **Then** the room exists in durable storage and the element is saved as an
   active record.
2. **Given** multiple elements are committed in one batch, **When** autosave writes the batch,
   **Then** the document clock increments once for the transaction and every active record in that
   batch receives the same record clock.

---

### User Story 2 - Durable deletion tombstones (Priority: P1)

As a collaborator deleting elements, I need deletions to persist as tombstones so a future reconnect
cannot resurrect older element copies.

**Why this priority**: Tombstones are required by the P3A reconnect model and must share the same
clock discipline as active records.

**Independent Test**: Can be tested by saving a deleted element and verifying the live record is
removed while a tombstone with the transaction clock is present.

**Acceptance Scenarios**:

1. **Given** a room has an active record, **When** an update batch contains the same element with
   `isDeleted = true`, **Then** the active record is removed and a tombstone is stored for the
   element id.
2. **Given** a later active update for a previously tombstoned element is accepted, **When** autosave
   flushes that update, **Then** the active record is upserted and the old tombstone for that element
   is cleared.

---

### User Story 3 - Autosave timing (Priority: P2)

As the backend operator, I need writes to be batched during active editing but flushed promptly when
a room becomes empty, reducing database churn while protecting data at natural session boundaries.

**Why this priority**: Throttled autosave protects performance; empty-room flush protects data when
the last client leaves.

**Independent Test**: Can be tested with fake timers by emitting updates, checking that immediate
database writes do not occur before the throttle window, then verifying a flush after the window or
on last-client disconnect.

**Acceptance Scenarios**:

1. **Given** a room receives one or more element updates, **When** fewer than 5 seconds have elapsed,
   **Then** autosave is scheduled but not flushed yet.
2. **Given** a room has pending updates, **When** the configured autosave delay elapses, **Then** the
   latest in-memory state for that room is flushed exactly once.
3. **Given** a room has pending updates and its last client disconnects, **When** room presence
   reaches zero clients, **Then** pending updates flush immediately instead of waiting for the
   remaining throttle delay.

---

### User Story 4 - Hot path remains in memory (Priority: P2)

As a collaborator making rapid edits, I need realtime broadcast behavior to remain responsive while
durability runs in the background.

**Why this priority**: SPECS.md requires `roomElements` to remain the authoritative hot path for
P3A. Database persistence must not block socket broadcasts.

**Independent Test**: Can be tested by mocking a slow persistence call and verifying the
`element-update` broadcast still happens synchronously after updating in-memory state.

**Acceptance Scenarios**:

1. **Given** the database write is pending or slow, **When** the backend receives an
   `element-update`, **Then** the in-memory room state is updated and peers receive the socket event
   without waiting for the database transaction.

### Edge Cases

- Autosave receives an empty batch: it should not increment `documentClock`.
- Multiple updates arrive for the same element before a scheduled flush: only the latest in-memory
  element state is persisted.
- The room does not exist yet: autosave creates the room with default metadata before writing
  records.
- Database write fails: the server logs the failure, keeps the in-memory state, and leaves the room
  dirty so a later flush can retry.
- Last-client disconnect happens while a scheduled flush timer exists: the timer is cleared and the
  flush runs immediately.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The backend MUST define durable room storage for rooms, room members, active element
  records, and deletion tombstones.
- **FR-002**: The backend MUST keep `roomElements` as the realtime authoritative hot path during
  P3A; database writes MUST be a durability backing store, not the source used for socket broadcast.
- **FR-003**: The backend MUST create or upsert a room before saving records or tombstones for that
  room.
- **FR-004**: The backend MUST increment a room's document clock exactly once per non-empty write
  transaction and assign that clock to every active record and tombstone produced by the transaction.
- **FR-005**: The backend MUST upsert non-deleted elements into active records with the full element
  state and the transaction record clock.
- **FR-006**: The backend MUST delete the active record and upsert a tombstone when an element with
  `isDeleted = true` is flushed.
- **FR-007**: The backend MUST clear an existing tombstone when a later non-deleted element with the
  same id is accepted and flushed.
- **FR-008**: The backend MUST schedule autosave after element updates using a configurable delay in
  the 5 to 10 second range, defaulting to 5 seconds.
- **FR-009**: The backend MUST flush pending room changes immediately when the room becomes empty.
- **FR-010**: The backend MUST avoid flushing clean rooms and MUST leave a failed room dirty for a
  later retry.
- **FR-011**: The backend MUST expose testable persistence/autosave units that can run without a real
  Socket.IO server.
- **FR-012**: The backend MUST keep existing P2 socket event payloads compatible for this feature;
  `ROOM_SNAPSHOT { elements, documentClock }` loading is reserved for P3A-02.

### Key Entities

- **Room**: Collaboration room metadata with durable `documentClock` and tombstone history start.
- **Record**: One active, non-deleted element in a room, keyed by room id and element id.
- **Tombstone**: One deleted element marker in a room, keyed by room id and element id.
- **Autosave Pending Room**: Runtime state that tracks dirty rooms, scheduled timers, and in-flight
  flushes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A non-empty save batch increments the room clock by exactly 1 and every saved row from
  that batch carries that same clock.
- **SC-002**: Pending room updates flush no later than 6 seconds after the first dirty update when the
  default delay is used.
- **SC-003**: When the last client leaves a dirty room, persistence starts immediately in the same
  disconnect handling cycle.
- **SC-004**: Realtime element broadcasts are not delayed by persistence; a mocked slow persistence
  call does not block the socket broadcast assertion.
- **SC-005**: All acceptance criteria AC-1 through AC-11 are covered by automated tests tagged with
  `@covers AC-n`.

## Assumptions

- This feature implements P3A-01 only. Loading persisted state on join and reconnect deltas are
  handled in P3A-02 through P3A-04.
- Local development already provides PostgreSQL through `docker-compose.yml` and `DATABASE_URL` in
  `.env` / `.env.example`.
- `RoomMember` is schema-ready for P3B auth/permission but P3A-01 does not create membership records.
- Prisma JSON stores the full shared `Element` object as the active record state.
- `documentClock` values may exceed JavaScript safe integer limits over time, so persistence code
  treats clocks as `bigint` internally and converts at boundaries only when needed later.
