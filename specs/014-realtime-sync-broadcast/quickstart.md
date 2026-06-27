# Quickstart Validation Guide: Realtime Sync & Broadcast

## Prerequisites

- `pnpm dev:all` running (frontend on :5173, backend on :3001)
- Two browser windows (or tabs) open

## Scenario 1 — Basic Broadcast (AC-1, AC-2, AC-3)

1. Open `http://localhost:5173/` in Window A → click "Create new room" → note the room URL.
2. Open the same room URL in Window B.
3. In Window A: draw a rectangle → **expected**: rectangle appears in Window B within ~200 ms. (AC-1)
4. In Window A: drag the rectangle to a new position → **expected**: Window B shows updated position. (AC-2)
5. In Window A: select the rectangle, press Delete → **expected**: rectangle disappears in Window B. (AC-3)

## Scenario 2 — Room Isolation (AC-4)

1. Open room URL `/` in Window A → create Room A.
2. Open a **different** room URL in Window B (create another room or type `/?room=other-id`).
3. In Window A: draw a shape → **expected**: Window B shows NO change. (AC-4)

## Scenario 3 — Optimistic Update (AC-5)

1. With browser DevTools network throttling set to "Slow 3G":
2. Draw a shape → **expected**: the shape appears on the canvas immediately (no delay visible to the user). (AC-5)

## Scenario 4 — LWW Convergence (AC-6~AC-10)

(Best verified via unit tests — see `apply-remote.test.ts` for deterministic LWW scenarios.)

Manual check: open two tabs in the same room, draw overlapping shapes rapidly in both → both tabs should converge to the same set of shapes within a few seconds.

## Scenario 5 — Protect Active Drag (AC-11)

1. Open room in two tabs (Tab A, Tab B).
2. In Tab A: start dragging an element (hold mouse button down).
3. In Tab B: move the same element to a different position.
4. In Tab A: while still dragging, observe → **expected**: element does NOT jump. (AC-11)
5. Release mouse in Tab A → tabs converge via LWW. (AC-14)

## Running Unit Tests

```bash
pnpm --filter whiteboard-fe test --run
```

Expected: all tests pass (including the new tests for AC-5, AC-10, AC-14).
