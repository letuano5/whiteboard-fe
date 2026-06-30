# Research: PostgreSQL Prisma Autosave

## Decision: Use Prisma schema under `backend/prisma/schema.prisma`

**Rationale**: P3A is backend-only and AGENTS.md already names Prisma 6.x and PostgreSQL 17.x for
P3A+. Keeping the schema inside `backend/` matches the `whiteboard-be` package boundary and avoids
adding root-level application code.

**Alternatives considered**:
- Root-level Prisma schema: rejected because persistence belongs to the backend package.
- Handwritten SQL only: rejected because SPECS.md explicitly calls for Prisma.

## Decision: Unit-test persistence against a mocked Prisma transaction boundary first

**Rationale**: The acceptance criteria mostly assert transaction semantics, clock assignment,
autosave scheduling, and socket non-blocking behavior. These can be tested deterministically without
requiring a live PostgreSQL service in every test run.

**Alternatives considered**:
- Require Docker/PostgreSQL for all tests: rejected because it slows the default repo test command
  and makes CI/local runs more brittle.
- Skip persistence tests until integration testing: rejected because AC coverage requires automated
  tests for every criterion now.

## Decision: Keep socket payloads unchanged in P3A-01

**Rationale**: SPECS.md splits persistence writes (P3A-01) from load-on-open (P3A-02), reconnect
(P3A-03), and delta push (P3A-04). Keeping the current `ROOM_SNAPSHOT { elements }` behavior avoids
shipping partial clock semantics too early.

**Alternatives considered**:
- Add `documentClock` to `ROOM_SNAPSHOT` immediately: rejected because P3A-02 owns snapshot loading
  and client clock persistence.

## Decision: Use an autosave manager with dependency injection

**Rationale**: Injecting `getRoomElements`, `saveRoomElements`, timers, and logger keeps the Socket.IO
entry point small and makes AC-5 through AC-8 testable without a real server.

**Alternatives considered**:
- Implement autosave directly inside `backend/src/index.ts`: rejected because it would make timer and
  failure tests harder and would couple persistence concerns to socket lifecycle code.
