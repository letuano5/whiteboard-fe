# Feature Specification: Delta Push theo Clock

**Feature Branch**: `023-delta-push-clock`

**Created**: 2026-06-29

**Status**: Draft

**Input**: User description: "P3A-04 Delta push theo clock — Server-side document clock management for element updates"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Clock advances on every element-update batch (Priority: P1)

When a client sends an `ELEMENT_UPDATE` with one or more elements, the server advances its in-memory `documentClock` by exactly 1 for that batch and includes the new clock value in the broadcast to all other room members. Every peer that receives the update stores the new clock so that future reconnect-diffs can reference the correct starting point.

**Why this priority**: Without this, `documentClock` only advances during the periodic autosave flush (DB path). In between flushes the clock is stale, so reconnecting clients would receive an incorrect diff range — they could miss updates that happened after the last autosave but before reconnect.

**Independent Test**: Join two clients to the same room. Have client A move a shape. Confirm that the `ELEMENT_UPDATE` broadcast received by client B carries a `documentClock` field that is one higher than the clock both clients last saw.

**Acceptance Scenarios**:

1. **Given** two clients A and B are in the same room with `documentClock = N`, **When** client A emits `ELEMENT_UPDATE` with one element, **Then** the server broadcasts `{ elements, documentClock: N+1, sessionId }` to client B.
2. **Given** client A sends `ELEMENT_UPDATE` with a batch of 3 elements, **When** the server processes the batch, **Then** `documentClock` increments by exactly 1 (not 3) and all 3 elements get `recordClock = N+1` on the next autosave flush.
3. **Given** the server receives two consecutive `ELEMENT_UPDATE` messages from different clients, **When** both are processed, **Then** `documentClock` advances by 1 for each message, producing clocks N+1 and N+2.

---

### User Story 2 — Client tracks `lastServerClock` from element-update broadcasts (Priority: P1)

After the feature, the client's `lastServerClock` reflects the clock from the most recent event received from the server — either `ROOM_SNAPSHOT` or `ELEMENT_UPDATE`. This ensures that when the client reconnects (P3A-03), it sends the correct `lastServerClock` to request only the diff since the last known server state.

**Why this priority**: Currently `lastServerClock` is only updated on `ROOM_SNAPSHOT`. Any edits made by peers while the client is connected advance the server clock but the client never learns about it, so on reconnect the client sends a stale clock and may receive a redundant or incorrect diff.

**Independent Test**: Join two clients. Have client B receive an `ELEMENT_UPDATE` from client A. Disconnect client B. Reconnect client B — the `lastServerClock` it sends in the reconnect event must equal the clock carried by the last `ELEMENT_UPDATE` it received, not the initial snapshot clock.

**Acceptance Scenarios**:

1. **Given** client B has `lastServerClock = 5` (from initial snapshot), **When** client B receives an `ELEMENT_UPDATE` with `documentClock: 7`, **Then** `getLastServerClock()` on client B returns `7`.
2. **Given** client B receives a `ROOM_SNAPSHOT` with `documentClock: 10` followed by an `ELEMENT_UPDATE` with `documentClock: 11`, **When** client B queries its last known clock, **Then** the value is `11`.
3. **Given** client B receives only a `ROOM_SNAPSHOT` (no subsequent ELEMENT_UPDATE), **When** queried, **Then** `lastServerClock` equals the snapshot's `documentClock` (existing behaviour unchanged).

---

### User Story 3 — No periodic full-resync runs (Priority: P2)

The codebase must not contain a timer-based full-resync mechanism that overwrites the clock-based diff protocol. If any such timer exists it must be removed. If drift is detected it should be handled by future work (P4-01a), not by a blanket resync.

**Why this priority**: A periodic full-resync would send the entire element set to every client on a schedule, defeating the purpose of clock-based diffing and wasting bandwidth. The clock protocol introduced in P3A-03 and P3A-04 is the authoritative mechanism for state reconciliation.

**Independent Test**: Audit the backend source for any `setInterval` or `setTimeout` call that emits `ROOM_RESYNC` or sends all room elements to connected clients. None should exist.

**Acceptance Scenarios**:

1. **Given** the backend is running, **When** a room has active clients for more than 30 seconds, **Then** no unsolicited full-element broadcast is emitted to any client.
2. **Given** the backend source, **When** searched for periodic timers that emit `ROOM_RESYNC` or full element sets, **Then** none are found.

---

### Edge Cases

- What happens when `ELEMENT_UPDATE` arrives for a room that does not yet have an in-memory `documentClock` entry (first update before any snapshot read)? Server initialises clock from DB (0 if room is new) then increments.
- What happens if the autosave flush fails after the in-memory clock was advanced? The in-memory clock stays advanced; the DB clock will catch up on the next successful flush.
- What happens when two `ELEMENT_UPDATE` messages arrive concurrently for the same room? Node.js event loop serialises them; each advances the clock independently (N+1, N+2).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Server MUST maintain a per-room `documentClock` counter in memory (separate from the DB-persisted value).
- **FR-002**: Server MUST increment the in-memory `documentClock` by exactly 1 when processing each `ELEMENT_UPDATE` batch, regardless of how many elements are in the batch.
- **FR-003**: Server MUST include `documentClock` in the `ELEMENT_UPDATE` broadcast sent to all peers (excluding the sender) after incrementing.
- **FR-004**: Server MUST pass the current in-memory `documentClock` to the autosave module so the DB flush uses the same clock value for `recordClock` assignment.
- **FR-005**: Client MUST update `lastServerClock` whenever it receives an `ELEMENT_UPDATE` that contains a `documentClock` field.
- **FR-006**: Client MUST NOT track a per-element `version sent` counter to manage clock; the server clock is the single source of truth.
- **FR-007**: The codebase MUST NOT contain any timer-based mechanism that emits full room state (full-resync) to connected clients.

### Key Entities

- **In-memory Room Clock**: A per-room integer counter managed by the server process. Starts at the value loaded from DB on room initialisation (join/warm-path) and increments on every `ELEMENT_UPDATE`.
- **documentClock (DB)**: The persisted counter in the `Room` table. Updated by the autosave module to catch up to the in-memory counter. The in-memory counter feeds this on flush.
- **lastServerClock (client)**: A module-level integer in the frontend socket client. Updated on `ROOM_SNAPSHOT` and on every received `ELEMENT_UPDATE` that carries a `documentClock`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After any element update, every connected peer's `lastServerClock` matches the server's current `documentClock` within the same event-loop tick (i.e., no clock drift while clients remain connected).
- **SC-002**: The server's in-memory `documentClock` advances monotonically — it never decreases or stalls during an active session with ongoing updates.
- **SC-003**: A client that disconnects after N element-update events and reconnects sends `lastServerClock = N` (relative to the last snapshot clock), enabling an exact diff with no redundant full-resync.
- **SC-004**: Zero full-room-element broadcasts occur during an active session beyond the initial `ROOM_SNAPSHOT` on join and the reconnect diff in P3A-03.

## Assumptions

- The existing autosave module (`createAutosaveManager`) already handles DB persistence; this feature only needs to wire the in-memory clock into the broadcast path and the autosave flush signature.
- The `documentClock` value is already loaded from the DB at room join time; P3A-04 adds the per-room in-memory map, initializes it from that loaded value, and keeps it updated on `ELEMENT_UPDATE`.
- No periodic full-resync timer exists in the current codebase (verified by code search); FR-007 is a safeguard for future additions.
- Frontend's existing `_lastServerClock` variable and `getLastServerClock()` function are the correct extension points — no new state structure is needed.
- The `ROOM_RESYNC` event in `WS_EVENTS` may remain as a named constant for future use; it does not need to be removed.
