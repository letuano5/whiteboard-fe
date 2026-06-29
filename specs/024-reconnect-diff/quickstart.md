# Quickstart / Validation Guide: Reconnect Without Data Loss (P3A-03)

## Prerequisites

- Docker running PostgreSQL (see `docker-compose.yml`)
- `pnpm install` at repo root
- `.env` with `DATABASE_URL` set for backend

## Setup

```bash
# Start DB
docker compose up -d

# Apply migrations
cd backend && pnpm prisma migrate deploy && cd ..

# Start backend + frontend
pnpm dev:all
```

## Validation Scenarios

### Scenario 1 — Incremental diff on reconnect (AC-1, AC-2, AC-3, AC-11, AC-12)

1. Open two browser tabs: Tab A and Tab B, both in the same room.
2. In Tab A: create or move an element. Confirm it appears in Tab B.
3. Simulate Tab B disconnect: open browser DevTools → Network → toggle "Offline".
4. In Tab A: create two more elements and move one existing element. Do NOT refresh.
5. Re-enable network in Tab B (toggle back online).
6. Observe in Tab B:
   - The three changes (2 new, 1 moved) appear within ~1 second — no full-page reload.
   - Browser Network panel shows no full element list in the WebSocket frame; only the diff.
   - Open DevTools Console: no "ROOM_SNAPSHOT received" log from the reconnect (should be "ROOM_DIFF received").

Expected: Tab B canvas matches Tab A. `ROOM_DIFF` event received. `documentClock` updated.

### Scenario 2 — Pending local changes replayed (AC-5, AC-6)

1. Open Tab A and Tab B in the same room.
2. Toggle Tab B offline.
3. In Tab B (while offline): move one element locally. It moves on Tab B's screen only.
4. Toggle Tab B back online.
5. Observe in Tab A: the element moved by Tab B appears at the new position within ~1 second.

Expected: Tab A receives an `ELEMENT_UPDATE` from Tab B after reconnect. Tab B did not emit during disconnect.

### Scenario 3 — LWW on conflicting pending change (AC-7)

1. Open Tab A and Tab B. Note the version of some Element E.
2. Toggle Tab B offline.
3. In Tab A: move Element E to position (100, 100). Tab A emits ELEMENT_UPDATE → server records it.
4. In Tab B (offline): move Element E to position (200, 200). Version bumped locally.
5. Toggle Tab B back online.
6. Tab B receives ROOM_DIFF with Element E at (100, 100) from server. LWW compares versions.
   - If Tab A's version > Tab B's offline version → Tab B canvas shows (100, 100).
   - If Tab B's offline version > Tab A's → Tab B replays (200, 200) via ELEMENT_UPDATE → server + Tab A update.
7. Verify that both tabs converge to the same position.

### Scenario 4 — Wipe-all when history is too short (AC-8, AC-9)

This requires a direct DB manipulation (can be verified via unit/integration test):

```bash
# In a psql session against your test DB:
# 1. Insert a tombstone with a very high deletedClock (simulates pruned history)
# 2. Connect client with lastServerClock = 1
# 3. Verify server emits ROOM_SNAPSHOT, not ROOM_DIFF
```

The integration test in `backend/src/persistence/room-repository.test.ts` covers this directly
(AC-8 and AC-9 verified there).

### Scenario 5 — No wipe-all when no tombstones (AC-10)

1. Start a fresh room (no deletions).
2. Simulate reconnect of a client.
3. Verify server returns ROOM_DIFF (even with empty `changed` and `deleted` arrays), not ROOM_SNAPSHOT.
4. Covered by unit tests: `getRoomDiff` returns `{ mode: 'diff', changed: [], deleted: [] }` for a room with no tombstones.

## Running Automated Tests

```bash
# All tests
pnpm test

# Backend only
pnpm --filter whiteboard-be test

# Frontend only
pnpm --filter whiteboard-fe test

# With coverage
pnpm --filter whiteboard-be test:coverage
```

AC coverage tags in test files: `// AC-N` comments map each test to an acceptance criterion.
