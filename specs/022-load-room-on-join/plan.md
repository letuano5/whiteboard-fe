# Implementation Plan: Load Room on Join

**Branch**: `feat/online-room` | **Date**: 2026-06-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/022-load-room-on-join/spec.md`

## Summary

P3A-02 makes the `ROOM_SNAPSHOT` payload authoritative by loading persisted room state from
PostgreSQL on join and including `documentClock` alongside `elements`. The backend adds a
`loadRoomElements` query (cold path) and a `getRoomClock` query (warm path clock) to
`room-repository.ts`, then wires them into the `JOIN_ROOM` handler. The frontend updates the
snapshot handler to call `applyRemoteElements` instead of `setElements` (consistent with the
regular sync path) and tracks `documentClock` as `_lastServerClock` for P3A-03 reconnect use.

## Technical Context

**Language/Version**: TypeScript 5.8.x (backend), TypeScript 6.x (frontend), Node.js 22.x LTS

**Primary Dependencies**: Express 5, Socket.IO 4.8.x, Prisma 6.x, `@prisma/client` 6.x,
React 19.x, Zustand 5.x, socket.io-client 4.8.x

**Storage**: PostgreSQL 17.x via Prisma (schema and client from P3A-01)

**Testing**: Backend Vitest 4.x (existing), Frontend Vitest 4.x (existing)

**Target Platform**: Node.js backend service + React/Vite frontend browser app

**Project Type**: Web application monorepo (`backend/`, `frontend/`, `packages/shared/`)

**Performance Goals**: DB load only on cold room join (first joiner after restart); subsequent
joiners read from in-memory state at O(n) element count.

**Constraints**:
- `BigInt` (Prisma) → `number` (socket payload) conversion at the boundary.
- Database errors MUST NOT crash the Socket.IO connection or block presence registration.
- P3A-02 MUST NOT add `documentClock` to `ELEMENT_UPDATE` broadcast or autosave — reserved for
  P3A-04.
- No frontend UI changes; snapshot is applied silently.
- Shared `WS_EVENTS.ROOM_SNAPSHOT` constant and event name remain unchanged.

**Scale/Scope**: 4–5 files modified across backend and frontend; no new libraries or schema
migrations required.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Unified Element Store — renderer holds no state | PASS | Snapshot applies to `elements.store.ts` only via `applyRemoteElements`; no renderer-side caching. |
| II | Element Versioning — `version++`, new `versionNonce`, `updatedAt` on every mutate | PASS | Backend persists already-versioned elements; no mutation of version fields during load. |
| III | Shared Camera Transform | PASS | Not touched by this feature. |
| IV | ShapeUtil Strategy | PASS | Not touched; load is element-type agnostic. |
| V | Sync Data Not Renderer — only `Element[]` crosses boundaries | PASS | `documentClock` is a sync protocol field carried alongside `Element[]`; no renderer state in the payload. |
| VI | Single Mutation Pipeline | PASS | Snapshot now uses `applyRemoteElements` which calls `dispatchMutationEvent` — fixes the current `setElements` direct-write shortcut. |
| VII | Committed vs Transient State — `elements.store` and `interaction.store` stay separate | PASS | `_lastServerClock` is module-level state in `socket-client.ts` (sync protocol tracking, not a store). |

No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/022-load-room-on-join/
├── spec.md
├── acceptance.md
├── plan.md              ← this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── room-snapshot-payload.md
├── checklists/
│   └── requirements.md
└── tasks.md             ← created by /speckit-tasks
```

### Source Code (repository root)

```text
backend/
└── src/
    ├── index.ts                              # update JOIN_ROOM handler (cold load + clock)
    └── persistence/
        ├── room-repository.ts                # add loadRoomElements(), getRoomClock()
        └── room-repository.test.ts           # extend with load tests (AC-1,AC-2,AC-3,AC-6,AC-7,AC-8)

frontend/
└── src/
    └── sync/
        ├── socket-client.ts                  # update ROOM_SNAPSHOT handler + _lastServerClock
        └── __tests__/
            └── socket-client.test.ts         # extend with AC-4, AC-5 tests
```

**Structure Decision**: Backend persistence changes in `room-repository.ts`, socket wiring in
`index.ts`. Frontend confined to one handler in `socket-client.ts`. Shared types unchanged.

## Complexity Tracking

> No constitution violations — table left empty.

---

## Phase 0: Research

See [research.md](./research.md). No external docs research needed: the Prisma query patterns
for `findUnique` / `findMany` follow the same conventions already established in `saveRoomElements`.
No new libraries or schema migrations are required.

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](./data-model.md).

### Interface Contracts

See [contracts/room-snapshot-payload.md](./contracts/room-snapshot-payload.md). Documents the
updated `ROOM_SNAPSHOT` socket event payload (adds `documentClock: number`).

### Quickstart Validation Guide

See [quickstart.md](./quickstart.md).

---

## Implementation Approach

### Backend — loadRoomElements and getRoomClock

Add two functions to `backend/src/persistence/room-repository.ts`:

**`loadRoomElements(db, roomId)`**
1. `db.room.findUnique({ where: { id: roomId }, select: { documentClock: true, records: true } })`
2. If not found → return `{ elements: [], documentClock: 0 }`.
3. Cast each `record.state` (Prisma JSON) to `Element`.
4. Return `{ elements: Element[], documentClock: Number(room.documentClock) }`.

**`getRoomClock(db, roomId)`**
1. `db.room.findUnique({ where: { id: roomId }, select: { documentClock: true } })`
2. If not found → return `0`.
3. Return `Number(room.documentClock)`.

### Backend — JOIN_ROOM handler wiring

In `createWhiteboardServer` → `JOIN_ROOM` handler:

```
let documentClock: number;
try {
  if (!elements.has(roomId) || elements.get(roomId)!.size === 0) {
    // Cold path: load from DB and populate in-memory map
    const loaded = await loadRoomElements(prisma, roomId);
    if (!elements.has(roomId)) elements.set(roomId, new Map());
    for (const el of loaded.elements) elements.get(roomId)!.set(el.id, el);
    documentClock = loaded.documentClock;
  } else {
    // Warm path: read clock from DB without re-loading elements
    documentClock = await getRoomClock(prisma, roomId);
  }
} catch (err) {
  console.error('[load-room] DB error during join:', err);
  documentClock = 0;
}
const snapshot = elements.has(roomId) ? [...elements.get(roomId)!.values()] : [];
socket.emit(WS_EVENTS.ROOM_SNAPSHOT, { elements: snapshot, documentClock });
```

### Frontend — ROOM_SNAPSHOT handler

In `socket-client.ts`, add module-level state and update the handler:

```typescript
let _lastServerClock = 0;

export function getLastServerClock(): number {
  return _lastServerClock;
}

// in initSocketClient:
_socket.on(WS_EVENTS.ROOM_SNAPSHOT, (data: { elements: Element[]; documentClock: number }) => {
  _lastServerClock = data.documentClock;
  applyRemoteElements(data.elements);
});
```

`applyRemoteElements` early-returns on empty arrays (AC-5 handled automatically).
