# Acceptance Criteria Registry: Reconnect Without Data Loss

**Feature**: [P3A-03] Reconnect không mất data
**Spec**: [spec.md](./spec.md)
**Created**: 2026-06-29
**Status**: Frozen (append-only after ratification)

---

## Criteria

### AC-1 — Server returns incremental diff for valid clock

**Source**: User Story 1, Acceptance Scenario 1

**Criterion**: Given client B has `lastServerClock = N` and the room has had `K` elements updated
since clock N, when client B reconnects and sends `lastServerClock: N` in `JOIN_ROOM`, then the
server returns a `ROOM_DIFF` event containing only those `K` changed elements and not all elements
in the room.

**Tags**: `backend`, `P1`

---

### AC-2 — Deleted elements are removed on reconnect

**Source**: User Story 1, Acceptance Scenario 2

**Criterion**: Given some elements were deleted by peers while client B was offline, when B
reconnects and receives the `ROOM_DIFF`, then those elements are removed from B's canvas and do not
remain as ghost elements.

**Tags**: `frontend`, `backend`, `P1`

---

### AC-3 — Canvas converges after diff application (no pending changes)

**Source**: User Story 1, Acceptance Scenario 3

**Criterion**: Given client B has no pending local changes when it reconnects, when the `ROOM_DIFF`
is applied, then B's canvas matches the state of all other connected clients.

**Tags**: `frontend`, `P1`

---

### AC-4 — New client with clock 0 receives full snapshot

**Source**: User Story 1, Acceptance Scenario 4

**Criterion**: Given client B's `lastServerClock = 0` (brand-new client with no prior clock), when
B joins the room, then the server returns the full `ROOM_SNAPSHOT` (existing behaviour) and does
not enter the reconnect-diff path.

**Tags**: `backend`, `P1`

---

### AC-5 — Pending local changes are re-emitted after diff

**Source**: User Story 2, Acceptance Scenario 1

**Criterion**: Given client B made 2 local element mutations while offline, when B reconnects and
the `ROOM_DIFF` is applied, then B emits an `ELEMENT_UPDATE` message carrying those 2 elements to
the server.

**Tags**: `frontend`, `P1`

---

### AC-6 — No spurious ELEMENT_UPDATE when no pending changes

**Source**: User Story 2, Acceptance Scenario 2

**Criterion**: Given client B has no pending local changes when it reconnects, when the `ROOM_DIFF`
is applied, then no `ELEMENT_UPDATE` event is emitted from B.

**Tags**: `frontend`, `P1`

---

### AC-7 — LWW resolves conflict between server diff and pending changes

**Source**: User Story 2, Acceptance Scenario 3

**Criterion**: Given client B's pending changes and the server diff both modify the same element
(same element ID), when B's pending changes are re-emitted after the diff, then Last-Write-Wins
via `version + versionNonce` determines the final state, and the result is consistent across all
clients and the server hot state. The frontend and backend use the same shared comparator.

**Tags**: `frontend`, `backend`, `P1`

---

### AC-8 — Wipe-all returned when tombstone history is insufficient

**Source**: User Story 3, Acceptance Scenario 1

**Criterion**: Given client B has `lastServerClock = 5` and the server's oldest tombstone has
`deletedClock = 8` (i.e., `lastServerClock < tombstoneHistoryStartsAtClock`), when B reconnects
with that clock, then the server returns a full `ROOM_SNAPSHOT` (wipe-all) instead of a
`ROOM_DIFF`.

**Tags**: `backend`, `P2`

---

### AC-9 — Wipe-all produces correct full canvas state

**Source**: User Story 3, Acceptance Scenario 2

**Criterion**: Given client B receives a wipe-all `ROOM_SNAPSHOT` response upon reconnect, when
the response is processed, then B's canvas matches the full current room state — identical to a
freshly joined client.

**Tags**: `frontend`, `P2`

---

### AC-10 — No wipe-all when room has no tombstones

**Source**: User Story 3, Acceptance Scenario 3

**Criterion**: Given there are no tombstones in the room (nothing was ever deleted), when B
reconnects with any `lastServerClock >= 0`, then the server always returns an incremental
`ROOM_DIFF` (possibly with empty `changed` and `deleted` arrays) and never a wipe-all snapshot.

**Tags**: `backend`, `P2`

---

### AC-11 — lastServerClock updated after ROOM_DIFF

**Source**: FR-007

**Criterion**: Given the client receives a `ROOM_DIFF` event, when the diff is processed, then the
client updates its `_lastServerClock` to the `documentClock` value carried in the diff response.

**Tags**: `frontend`, `P1`

---

### AC-12 — ROOM_DIFF is a distinct WS event from ROOM_SNAPSHOT

**Source**: FR-010, FR-011

**Criterion**: Given the server sends a reconnect-diff response, the response uses a new
`ROOM_DIFF` WebSocket event (defined in `WS_EVENTS` in `@vdt/shared`) that is separate from the
`ROOM_SNAPSHOT` event, so clients can dispatch to the correct handler.

**Tags**: `backend`, `frontend`, `P1`
