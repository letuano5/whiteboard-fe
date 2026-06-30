# Implementation Plan: PostgreSQL Prisma Autosave

**Branch**: `feat/online-room` | **Date**: 2026-06-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/021-postgresql-prisma-autosave/spec.md`

## Summary

P3A-01 adds durable backend persistence while preserving the existing realtime hot path. The backend
will add Prisma/PostgreSQL schema and a small persistence/autosave layer. `roomElements` remains the
authoritative in-memory state for socket broadcasts; every committed `element-update` marks the room
dirty and schedules an autosave. A successful flush writes the latest room state in one transaction:
increment `documentClock` once, upsert active `Record` rows, delete active rows for deleted elements,
and upsert `Tombstone` rows.

## Technical Context

**Language/Version**: TypeScript 5.8.x, Node.js 22.x LTS (backend only)

**Primary Dependencies**: Express 5, Socket.IO 4.8.x, Prisma 6.x, `@prisma/client` 6.x, PostgreSQL
17.x, dotenv for backend runtime `.env` loading.

**Storage**: PostgreSQL via Prisma. Existing `docker-compose.yml` and `.env.example` already define
PostgreSQL and `DATABASE_URL`.

**Testing**: Backend Vitest 4.x will be added for persistence/autosave unit tests. Prisma client is
mocked for unit tests; migration/schema validation is covered by Prisma generate/typecheck.

**Target Platform**: Node.js backend service.

**Project Type**: Web application monorepo (`backend/`, `frontend/`, `packages/shared/`).

**Performance Goals**: Socket broadcast remains synchronous with the in-memory update. Default
autosave delay is 5 seconds, configurable up to the SPECS.md range of 5-10 seconds.

**Constraints**:
- P3A-01 must not implement P3A-02 room loading, P3A-03 reconnect, or P3A-04 clock delta push.
- Existing P2 socket payload compatibility remains intact for this feature.
- No frontend source changes are planned.
- Database failures must not crash the socket server or clear pending dirty state.

**Scale/Scope**: Backend-only feature touching Prisma schema/config, package scripts/dependencies,
and `backend/src/index.ts` plus new backend persistence modules and tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Unified Element Store - renderer holds no state | PASS | Backend persistence stores shared `Element` data only; no renderer state involved. |
| II | Element Versioning - `version++`, new `versionNonce`, `updatedAt` on every mutate | PASS | Backend persists already-versioned elements from the client pipeline and does not mutate versions. |
| III | Shared Camera Transform | PASS | Not touched by backend persistence. |
| IV | ShapeUtil Strategy | PASS | Not touched; persistence is element-type agnostic except `isDeleted`. |
| V | Sync Data Not Renderer | PASS | Database records store serialized `Element` data only. |
| VI | Single Mutation Pipeline | PASS | Frontend mutation pipeline remains unchanged; backend subscribes to committed socket events. |
| VII | Committed vs Transient State | PASS | Only committed elements from `element-update` are persisted; drafts, presence, cursor, camera, and interaction state are excluded. |

No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/021-postgresql-prisma-autosave/
├── spec.md
├── acceptance.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── autosave-lifecycle.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   └── schema.prisma                 # new: Room, RoomMember, Record, Tombstone
├── src/
│   ├── index.ts                      # wire autosave scheduling and empty-room flush
│   ├── persistence/
│   │   ├── prisma.ts                 # PrismaClient singleton
│   │   ├── room-repository.ts        # transactional saveRoomElements
│   │   └── autosave.ts               # dirty-room scheduler and flush orchestration
│   └── test/
│       ├── element-fixtures.ts       # shared test fixtures
│       ├── room-repository.test.ts   # AC-1..AC-4, AC-9, AC-10
│       ├── autosave.test.ts          # AC-5..AC-7, AC-10
│       └── socket-autosave.test.ts   # AC-8
├── package.json                      # Prisma/Vitest scripts and dependencies
└── tsconfig.json                     # include tests if needed
```

**Structure Decision**: Keep persistence code inside `backend/src/persistence/` to avoid bloating
the Socket.IO entry point. Keep Prisma schema under `backend/prisma/` so backend scripts can run with
`pnpm --filter whiteboard-be prisma ...`.

## Complexity Tracking

> No constitution violations - table left empty.

---

## Phase 0: Research

See [research.md](./research.md). No external docs research is required: AGENTS.md already fixes the
Prisma/PostgreSQL versions, and existing repo config defines PostgreSQL environment variables.

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](./data-model.md).

### Internal Contract

See [contracts/autosave-lifecycle.md](./contracts/autosave-lifecycle.md). There are no public socket
contract changes in P3A-01.

### Quickstart Validation Guide

See [quickstart.md](./quickstart.md).

---

## Implementation Approach

### Persistence Transaction

`saveRoomElements(roomId, elements)`:

1. Returns without writing when `elements.length === 0`.
2. Runs one Prisma transaction.
3. Upserts `Room`.
4. Increments `Room.documentClock` by 1 and reads the new clock.
5. For each element:
   - if `isDeleted === false`: upsert `Record`, delete matching `Tombstone`;
   - if `isDeleted === true`: delete matching `Record`, upsert `Tombstone`.
6. Returns the new `documentClock`.

### Autosave Runtime

`createAutosaveManager({ delayMs, getRoomElements, saveRoomElements, logger })`:

- `markDirty(roomId)` marks the room dirty and schedules a timer if one is not already scheduled.
- `flushRoom(roomId)` clears the timer, saves the latest in-memory elements, and marks the room clean
  only after success.
- `flushRoomNow(roomId)` is used by disconnect handling when a room reaches zero clients.
- Failed flushes log the error and keep the dirty flag for a later scheduled/manual retry.

### Socket Wiring

- On `element-update`: update `roomElements`, schedule autosave, then broadcast to peers as today.
- On disconnect: after removing presence, if room presence is empty, call `flushRoomNow(roomId)`.
- P3A-01 does not change the join snapshot payload. P3A-02 will load persisted room state and add
  `documentClock` to `ROOM_SNAPSHOT`.
