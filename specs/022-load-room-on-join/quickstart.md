# Quickstart Validation Guide: Load Room on Join

**Feature**: [P3A-02] Load khi mở phòng
**Date**: 2026-06-29

## Prerequisites

- Docker running: `docker compose up -d` (PostgreSQL)
- Backend dependencies: `pnpm --filter whiteboard-be install`
- `.env` with `DATABASE_URL` pointing to local PostgreSQL
- Prisma client generated: `pnpm --filter whiteboard-be prisma generate`
- Migration applied: `pnpm --filter whiteboard-be prisma migrate dev`

## Scenario 1: Cold load — elements survive server restart (AC-1)

1. Start backend: `pnpm --filter whiteboard-be dev`
2. Open browser at `http://localhost:5173/?room=test-room-001`
3. Draw several shapes on the canvas.
4. Wait ~6 seconds for autosave to flush (or trigger by closing the tab).
5. Stop and restart the backend process.
6. Open a **new** browser tab at `http://localhost:5173/?room=test-room-001`
7. **Expected**: All drawn shapes appear immediately without any manual refresh.
8. **Expected**: Browser console / network tab shows `ROOM_SNAPSHOT` with `documentClock > 0`.

## Scenario 2: Empty room (AC-3)

1. Start backend.
2. Open browser at `http://localhost:5173/?room=brand-new-room-xyz`
3. **Expected**: Canvas is empty, no errors in console.
4. **Expected**: `ROOM_SNAPSHOT` payload has `{ elements: [], documentClock: 0 }`.

## Scenario 3: Subsequent joiner uses warm path (AC-2)

1. Start backend.
2. Open Tab A at `http://localhost:5173/?room=warm-room-test`, draw a shape.
3. Wait for autosave flush.
4. Open Tab B at `http://localhost:5173/?room=warm-room-test` (room is hot in memory).
5. **Expected**: Tab B shows the same shape.
6. **Expected**: Backend logs show DB load only once (for Tab A or server start, not for Tab B).

## Scenario 4: Client tracks lastServerClock (AC-4)

1. Open browser DevTools → Console.
2. After joining a room with saved elements, run:
   ```javascript
   // import is not available in console directly; verify via test suite
   ```
   Alternatively, run the frontend test: `pnpm --filter whiteboard-fe test --run socket-client`.
3. **Expected**: Tests tagged `@covers AC-4` and `@covers AC-5` pass.

## Automated test commands

```bash
# Backend unit tests (all AC-n for backend)
pnpm --filter whiteboard-be test --run

# Frontend unit tests (AC-4, AC-5)
pnpm --filter whiteboard-fe test --run

# Full typecheck
pnpm typecheck

# Lint
pnpm lint
```

## Verification Checklist

- [ ] Cold restart scenario: elements visible after backend restart
- [ ] Empty room: no errors, `documentClock: 0`
- [ ] Warm path: no redundant DB load for second joiner
- [ ] `ROOM_SNAPSHOT` payload includes `documentClock: number` (not BigInt, not string)
- [ ] Backend tests: AC-1, AC-2, AC-3, AC-6, AC-7, AC-8 pass
- [ ] Frontend tests: AC-4, AC-5 pass
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean
