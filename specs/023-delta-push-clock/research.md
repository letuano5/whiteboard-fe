# Research: Delta Push theo Clock

**Feature**: P3A-04  
**Date**: 2026-06-29

## Decision Log

### D-01: In-memory clock storage strategy

**Decision**: Add a module-level `Map<roomId, number>` (e.g. `roomClocks`) in `backend/src/index.ts`, mirroring the existing `roomElements` map.

**Rationale**: The `documentClock` per-room counter must survive across multiple `ELEMENT_UPDATE` events without a DB round-trip. Keeping it module-level (parallel to `roomElements`) is the minimal change consistent with the existing architecture. No new module or class is needed.

**Alternatives considered**:
- Store clock inside each room's element map value — rejected; would require changing `Map<roomId, Map<elementId, Element>>` to a compound type and touching all callsites.
- Read clock from DB on every `ELEMENT_UPDATE` — rejected; a DB round-trip per update blocks the broadcast and defeats the purpose.

---

### D-02: Clock initialisation and lifecycle

**Decision**: On the cold path, initialise `roomClocks.set(roomId, loaded.documentClock)` from the DB value already fetched by `loadRoomElements`. On the warm path, `roomClocks` is already set from a previous join; skip re-initialisation unless the room clock is missing. Keep the room clock in memory alongside `roomElements` after the last client leaves; both are the authoritative hot path until process restart.

**Rationale**: The join handler already branches on cold/warm. Reusing the already-fetched `documentClock` from `loadRoomElements` avoids an extra DB query. If a second client joins while the room is warm, the in-memory clock is already current — no DB read needed. Retaining the clock with the hot element state avoids losing live-session clock progress if an immediate empty-room flush fails and the room is rejoined before process restart.

**Alternatives considered**:
- Always re-read clock from DB on join — rejected; unnecessary extra DB round-trip on warm path.
- Delete the clock when the room empties — rejected; current `roomElements` are intentionally retained after empty-room flush, so deleting only the clock can make hot state and clock state diverge.

---

### D-03: Clock included in ELEMENT_UPDATE broadcast payload

**Decision**: Add `documentClock: number` to the `ELEMENT_UPDATE` broadcast emitted to peers. The sender does NOT receive an ack in this phase (P4-01a handles ack).

**Rationale**: Peers need to update their `lastServerClock` without a separate ack event. Piggy-backing on the existing broadcast is the minimal change. The sender's own `lastServerClock` is updated by the frontend mutation-hook optimistically or via the next received peer broadcast — see D-04.

**Alternatives considered**:
- Separate `ELEMENT_UPDATE_ACK` to sender only — deferred to P4-01a per SPECS.md.
- Include clock in broadcast only to receiver, not sender — impossible with the current `socket.to(roomId).emit` pattern; the sender is excluded by Socket.IO room semantics.

---

### D-04: Sender's lastServerClock update

**Decision**: The sender does NOT update `lastServerClock` in this phase. The sender learns the server clock via the next `ELEMENT_UPDATE` broadcast it receives from a peer, or on its next `ROOM_SNAPSHOT`. This is acceptable because the clock only matters for reconnect diffs (P3A-03), and on reconnect the server will send a corrected diff anyway.

**Rationale**: Minimal change. The sender updating its own clock would require either a server ack (P4-01a) or an echo-to-self pattern. Both are deferred.

**Alternatives considered**:
- Add ack event so sender updates immediately — deferred to P4-01a.
- Echo the broadcast back to the sender — rejected; breaks the existing pattern and would trigger duplicate `applyRemoteElements` on the sender.

---

### D-05: Autosave clock relationship

**Decision**: Autosave receives the current in-memory room clock as `targetDocumentClock` and persists all records/tombstones in that flush with that exact clock. `saveRoomElements` updates `Room.documentClock` to the maximum of the existing persisted clock and `targetDocumentClock`, never decreasing it.

**Rationale**: `docs/SPECS.md` requires each `ELEMENT_UPDATE` batch to advance the server document clock and the throttled DB persist to assign `recordClock = documentClock`. Reconnect diffs query records/tombstones by clock, so durable state must catch up to the same live-session clock that peers received in broadcasts.

**Alternatives considered**:
- Let the repository increment DB clock once per flush — rejected; this can collapse multiple live update clocks into one durable clock and conflicts with P3A-04.
- Add a separate ack event so the sender learns the new clock immediately — deferred to P4-01a.

---

### D-06: Periodic full-resync

**Decision**: No periodic full-resync exists in the current codebase. FR-007 is satisfied by the absence of such code. No action required beyond a code-search confirmation in the implementation tasks.

**Rationale**: Grep confirms no `setInterval`/`setTimeout` calls emit `ROOM_RESYNC` or full element sets. The `WS_EVENTS.ROOM_RESYNC` constant can remain for future use.
