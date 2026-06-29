# Research: Realtime Sync & Broadcast (P2-02~P2-05)

**Status**: No new research needed — all decisions pre-made in P2-01 (spec 013).

## Prior Decisions (from 013/plan.md Phase 0)

### Finding 1 — Socket.IO rooms
**Decision**: `socket.join(roomId)` / `socket.to(roomId).emit()`
**Rationale**: Built-in to Socket.IO 4.x; no manual room tracking needed.

### Finding 2 — Socket.IO client lifecycle
**Decision**: Module-level singleton `_socket` in `socket-client.ts`
**Rationale**: Matches BroadcastChannel pattern; no React lifecycle needed.

### Finding 3 — applyRemoteElements reuse
**Decision**: Single function handles both BroadcastChannel (P1B) and Socket.IO (P2) paths.
**Rationale**: Constitution Principle VIII (one apply-remote); already established in 012 spec.

### Finding 4 — LWW tiebreaker
**Decision**: Higher `version` wins; equal version → lower `versionNonce` wins.
**Rationale**: Deterministic without coordination; already in Constitution §Conflict Resolution.

### Finding 5 — Optimistic update
**Decision**: Mutation pipeline writes to store first, then fires hooks (including socket emit).
**Rationale**: Standard optimistic UI pattern; render is synchronous in Zustand.
