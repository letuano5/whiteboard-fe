# Research: Load Room on Join

**Feature**: [P3A-02] Load khi mở phòng
**Date**: 2026-06-29

## Summary

No external research was needed. All patterns are established by P3A-01 and the existing
codebase. This file documents the decisions derived from reading existing code.

---

## Decision 1: Prisma query approach for loadRoomElements

**Decision**: Use `db.room.findUnique` with `include: { records: true }` to fetch the Room row
and all its Record rows in one query.

**Rationale**: A single JOIN is more efficient than two separate queries. The `records` relation
is already declared in `schema.prisma` (`Room` → `Record[]` via `roomId`). Prisma's `include`
handles the join transparently.

**Alternatives considered**:
- Two separate queries (`findUnique` for clock, `findMany` for records): simpler to read but two
  round-trips. Rejected because single-join is the idiomatic Prisma pattern.
- Raw SQL: unnecessary complexity given Prisma already models the relation.

---

## Decision 2: BigInt → number conversion

**Decision**: Convert `documentClock` from `BigInt` (Prisma storage type) to `number` at the
repository boundary using `Number(bigint)`.

**Rationale**: Socket.IO serializes payloads as JSON; `BigInt` cannot be serialized by JSON
natively. Converting at the repository boundary keeps socket-layer code clean. Expected clock
values are far below `Number.MAX_SAFE_INTEGER` for any realistic room session.

**Alternatives considered**:
- Pass `bigint` through and serialize as string: would require frontend to parse strings, adding
  friction. Rejected.
- Use `Number()` cast in socket handler: moves conversion out of the repository, creating a
  leaky abstraction. Rejected.

---

## Decision 3: Warm path clock read

**Decision**: Add a separate `getRoomClock(db, roomId)` function for the warm path (room already
in memory) instead of a full element reload.

**Rationale**: When a room is hot (active users present), re-querying all records is wasteful.
Only the current `documentClock` is needed for the snapshot payload. A single-column
`findUnique` is O(1) regardless of element count.

**Alternatives considered**:
- Always call `loadRoomElements` (even when warm): simple but loads all records needlessly for
  every subsequent joiner while the room is active. Rejected per AC-2 (FR-004).
- Track `documentClock` in memory alongside `roomElements`: would require in-memory clock state
  to be updated on every autosave flush. This overlaps with P3A-04 scope. Deferred.

---

## Decision 4: Error handling on join

**Decision**: Wrap the DB load in a `try/catch`; on error, log and fall back to whatever is
in memory (possibly empty) with `documentClock = 0`.

**Rationale**: The socket join must succeed regardless of DB health — presence registration and
`USER_JOIN` broadcast must still happen. A failed DB load produces a degraded but functional
session (room appears empty; user can still collaborate if others are present).

**Alternatives considered**:
- Reject the socket join on DB error: too aggressive; breaks the app for all users in the room.
  Rejected.
- Emit a separate error event to the client: out of scope for P3A-02. Deferred.
