# Quickstart Validation Guide: Delta Push theo Clock

**Feature**: P3A-04  
**Date**: 2026-06-29

## Prerequisites

- Docker running with PostgreSQL (`pnpm --filter whiteboard-be db:up` or equivalent)
- Dependencies installed: `pnpm install`
- Database migrated: `pnpm --filter whiteboard-be db:migrate`

## Start Dev Environment

```bash
pnpm dev:all
```

Open two browser tabs to `http://localhost:5173/?room=<same-uuid>`.

---

## Scenario 1 — Clock advances in peer broadcast (AC-1, AC-2)

1. Open browser DevTools → Network → WS in both Tab A and Tab B.
2. In Tab A, move or create a shape.
3. In Tab B's WS frame log, inspect the received `element-update` message.
4. **Expected**: payload contains `documentClock: <N>` where N is 1 higher than the `room-snapshot` clock both tabs received on join.
5. Move another shape in Tab A. Inspect Tab B's next `element-update`.
6. **Expected**: `documentClock` is N+1 (monotonically increasing).

---

## Scenario 2 — Three-update batch increments clock by 1 (AC-2)

1. In Tab A, select 3 shapes and move them simultaneously (one `ELEMENT_UPDATE` with 3 elements).
2. In Tab B, inspect the single `element-update` frame received.
3. **Expected**: `documentClock` increments by exactly 1 compared to the previous value; all 3 elements are in the `elements` array.

---

## Scenario 3 — Client B tracks lastServerClock (AC-1 frontend)

Run this in Tab B's browser console:

```js
// After import resolution — this assumes the module is exposed via window for testing
// Alternatively use the app's debug info or intercept the WS message
```

Alternatively use a unit test (see test plan in tasks.md) to confirm `getLastServerClock()` returns the clock from the last `element-update` received.

Manual proxy: Open DevTools → Console in Tab B → intercept `socket.on('element-update', ...)` message. After Tab A makes an edit, verify that the value reported by `getLastServerClock()` (if exposed) matches the `documentClock` in the WS frame.

---

## Scenario 4 — No periodic full-resync (FR-007)

1. Leave both tabs connected and idle for 60 seconds.
2. In the WS frame log of either tab, verify no unsolicited `element-update` or `room-resync` frames appear.
3. **Expected**: Only the initial `room-snapshot` and any user-triggered `element-update` frames are visible.

---

## Automated Tests

Unit tests cover the following (see `tasks.md` for AC mapping):

- **Backend**: `ELEMENT_UPDATE` handler increments in-memory clock and includes it in broadcast.
- **Backend**: Multiple consecutive updates produce monotonically increasing clocks.
- **Frontend**: `_lastServerClock` updated on `element-update` with `documentClock`.
- **Frontend**: `_lastServerClock` unchanged when `element-update` lacks `documentClock` (backward compatibility guard).

Run:
```bash
pnpm test
```
