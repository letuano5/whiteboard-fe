# Feature Specification: Reconnect Without Data Loss

**Feature Branch**: `feat/online-room`

**Created**: 2026-06-29

**Status**: Draft

**Input**: User description: "P3A-03 Reconnect không mất data — Socket.IO tự reconnect; client gửi lastServerClock khi reconnect. Client áp diff nhận về: upsert changed elements, xóa deleted khỏi store (applyRemoteElements). Thay đổi cục bộ chưa kịp gửi: gửi lại qua ELEMENT_UPDATE sau khi đã áp server diff. BE nhận lastServerClock từ client, trả về diff { changed: Record[], deleted: Tombstone[], documentClock } nếu clock hợp lệ; hoặc wipe_all (full snapshot như P3A-02) nếu clock quá cũ."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Reconnect and receive incremental diff (Priority: P1)

A user loses connectivity briefly (network blip, laptop sleep) and their browser reconnects automatically. When Socket.IO reconnects, the client sends the last server clock it received so the server can return only the elements that changed while the user was offline. The client merges those changes into its local canvas without losing its own work.

**Why this priority**: This is the core value proposition of the feature — avoiding a full resync on every reconnect saves bandwidth and prevents the canvas from flickering/jumping for every participant on an unstable network.

**Independent Test**: Join two clients A and B. Make edits with A. Disconnect B (simulate network drop). Make more edits with A. Reconnect B. Observe that B receives only the diff (not all elements) and that its canvas reflects the new state without losing B's own uncommitted changes.

**Acceptance Scenarios**:

1. **Given** client B has `lastServerClock = N` and the room has had `K` elements updated since clock N, **When** client B reconnects and sends `lastServerClock: N`, **Then** the server returns only those `K` changed elements (not all elements in the room).
2. **Given** some elements were deleted while B was offline, **When** B reconnects and receives the diff, **Then** those elements are removed from B's canvas, not left as ghosts.
3. **Given** client B has no pending local changes, **When** the diff is applied, **Then** B's canvas matches the state of all other connected clients.
4. **Given** client B's `lastServerClock = 0` (brand-new client with no prior clock), **When** B joins, **Then** server returns the full snapshot (existing behaviour — not a reconnect diff).

---

### User Story 2 — Pending local changes are replayed after diff (Priority: P1)

While the user was briefly disconnected, they continued drawing (optimistic local edits). After reconnecting and applying the server diff, the client re-emits those pending changes so peers can see them and they are persisted.

**Why this priority**: Without this, any user who makes an offline edit and then reconnects silently loses that work — it exists on their screen but never reaches the server or peers.

**Independent Test**: Disconnect client B. Make an edit in B (locally visible). Reconnect B. Confirm that the edit appears on client A's canvas within a normal sync delay.

**Acceptance Scenarios**:

1. **Given** client B made 2 local element moves while offline, **When** B reconnects and the server diff is applied, **Then** B emits an `ELEMENT_UPDATE` carrying those 2 elements to the server.
2. **Given** client B has no pending local changes when it reconnects, **When** the diff is applied, **Then** no spurious `ELEMENT_UPDATE` is emitted.
3. **Given** client B's pending changes conflict with server diff changes on the same element (same element ID), **When** B's pending changes are re-emitted after the diff, **Then** LWW via `version + versionNonce` determines the final state.

---

### User Story 3 — Server history too short: wipe-all fallback (Priority: P2)

If the client has been offline long enough that the server's deletion history (tombstones) no longer covers the time since `lastServerClock`, the server cannot guarantee a safe incremental diff. In this case it falls back to sending the full room snapshot, exactly like the initial join.

**Why this priority**: This edge case is rare (requires extended offline time beyond tombstone retention) but must not result in ghost elements (elements that should be deleted but aren't). The full snapshot is the safe fallback.

**Independent Test**: Simulate a scenario where a client's `lastServerClock` predates the oldest stored tombstone. Confirm the server responds with a full snapshot rather than an incomplete diff.

**Acceptance Scenarios**:

1. **Given** client B has `lastServerClock = 5` and the server's oldest tombstone has `deletedClock = 8`, **When** B reconnects with that clock, **Then** the server returns a full snapshot (wipe-all) instead of a diff.
2. **Given** client B receives a wipe-all response, **When** the response is processed, **Then** B's canvas matches the full current room state (same as after a fresh join).
3. **Given** there are no tombstones in the room (nothing was ever deleted), **When** B reconnects with any `lastServerClock >= 0`, **Then** an incremental diff is always returned (no wipe-all needed).

---

### Edge Cases

- What happens when the reconnect diff contains zero changes? (Client is already up-to-date — server returns `{ changed: [], deleted: [], documentClock }` and client updates its clock without mutating elements.)
- What if the server restarts between the client's disconnect and reconnect? (In-memory state is empty; the server cold-loads from DB and sends a full snapshot regardless of `lastServerClock`, because a new DB-driven documentClock starts fresh.)
- What if multiple rapid reconnects occur? (Each reconnect sends the latest `lastServerClock`; duplicate diffs may arrive but `applyRemoteElements` LWW makes repeated application idempotent.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a Socket.IO reconnect event fires, the client MUST send `JOIN_ROOM` carrying `lastServerClock` (its last known server clock) in addition to existing identity fields.
- **FR-002**: The server MUST inspect the `lastServerClock` field in `JOIN_ROOM`: if absent or `0`, it behaves as an initial join (returns full `ROOM_SNAPSHOT`); if present and `> 0`, it enters the reconnect-diff path.
- **FR-003**: On the reconnect-diff path, the server MUST compute `tombstoneHistoryStartsAtClock` — the smallest `deletedClock` among all tombstones for the room (or `+∞` / no constraint when no tombstones exist).
- **FR-004**: If `lastServerClock >= tombstoneHistoryStartsAtClock` (history is sufficient), the server MUST return a `ROOM_DIFF` message containing: `{ changed: Element[], deleted: { id: string }[], documentClock: number }`, where `changed` are elements updated after `lastServerClock` and `deleted` are element IDs removed after `lastServerClock`.
- **FR-005**: If `lastServerClock < tombstoneHistoryStartsAtClock` (history too short), the server MUST return a full `ROOM_SNAPSHOT` (wipe-all) identical to the initial-join response.
- **FR-006**: The client MUST handle a new `ROOM_DIFF` event by calling `applyRemoteElements` with `changed` elements (upsert via LWW) and removing each `deleted` ID from the element store.
- **FR-007**: After applying a `ROOM_DIFF`, the client MUST update `_lastServerClock` to the `documentClock` value in the diff response.
- **FR-008**: After applying `ROOM_DIFF` (not after wipe-all), the client MUST re-emit any locally-queued pending element changes via `ELEMENT_UPDATE`.
- **FR-009**: The client MUST queue any element mutations that occur while the socket is disconnected, and clear that queue after successfully replaying it on reconnect.
- **FR-010**: The `ROOM_DIFF` response MUST be a new WebSocket event distinct from `ROOM_SNAPSHOT` so clients can dispatch to the correct handler.
- **FR-011**: The new `ROOM_DIFF` WS event constant MUST be added to `WS_EVENTS` in `@vdt/shared`.
- **FR-012**: The server MUST apply the same whole-element LWW comparator as the client before accepting replayed `ELEMENT_UPDATE` payloads: higher `version` wins; when versions tie, lower `versionNonce` wins.
- **FR-013**: The shared LWW comparator MUST live in `@vdt/shared` and be reused by both frontend `applyRemoteElements` and backend `ELEMENT_UPDATE` handling.
- **FR-014**: `documentClock` MUST remain a room-level sync cursor. The server only increments it when at least one incoming element is accepted by the shared LWW comparator; discarded batches MUST NOT advance the clock or be broadcast.

### Key Entities

- **Reconnect Diff**: `{ changed: Element[], deleted: { id: string }[], documentClock: number }` — a partial state update since a given clock value.
- **Tombstone**: A record of a deleted element keyed by `id` with the `deletedClock` at which it was removed (already exists in DB schema from P3A-01).
- **tombstoneHistoryStartsAtClock**: The smallest `deletedClock` across all tombstones for the room; used to determine if a full diff is possible.
- **Pending Queue**: A client-side buffer of element mutations accumulated while the socket was disconnected.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After reconnecting following a brief disconnect, a client's canvas converges to the correct shared state within the normal sync delay (≤ 1 second under typical conditions) without requiring a full page reload.
- **SC-002**: The reconnect payload size is proportional to the number of changes made while offline, not the total number of elements in the room; for zero offline changes, the payload carries no element data.
- **SC-003**: Any element mutations the user made while offline appear on all peers' canvases within the normal sync delay after reconnect, with no user action required.
- **SC-004**: No element that was deleted by a peer while the user was offline remains visible as a "ghost" on the reconnected client's canvas.
- **SC-005**: The full-snapshot fallback (wipe-all) leaves the reconnected client's canvas identical to a freshly joined client.

## Assumptions

- Socket.IO's automatic reconnect is already enabled (default behavior); no reconnect configuration changes are needed.
- The DB schema from P3A-01 already stores `recordClock` on `Record` rows and `deletedClock` on `Tombstone` rows — these are the fields used to compute diffs.
- Tombstone history is unlimited in P3A-03 (no pruning); the wipe-all path is a safety guard for cases where future pruning or server restarts create gaps. In practice the wipe-all path will be rare.
- "Pending local changes" are element mutations from the mutation pipeline that the client attempted to emit via `ELEMENT_UPDATE` while the socket was disconnected (Socket.IO buffers these internally but they may need explicit management to ensure correct ordering after diff application).
- LWW conflict resolution (`version + versionNonce`) is implemented via a shared comparator in `@vdt/shared`; `applyRemoteElements` and backend `ELEMENT_UPDATE` handling must use the same helper so replayed pending changes cannot be accepted by the server after losing the client-side comparator.
- The diff is computed from the DB (autosaved state); in-memory elements not yet autosaved will be included if the server merges in-memory hot state on top of the DB query. The server implementation MUST ensure the diff is authoritative at the moment of reconnect.
