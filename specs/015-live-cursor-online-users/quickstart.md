# Quickstart Validation Guide: Live Cursor & Online Users

## Prerequisites

- `pnpm dev:all` running (frontend on :5173, backend on :3001)
- Two browser windows / tabs (can be same browser)

## Scenario 1: Live cursors appear between users (AC-1, AC-2, AC-3, AC-7)

1. Open `http://localhost:5173` in Tab A → click "Create Room" → copy the URL.
2. Open the same URL in Tab B.
3. In Tab A, move the mouse around the canvas.
4. **Expected**: A cursor indicator (arrow + name label) appears and tracks in Tab B within ~100 ms.
5. Move cursor to a different area. **Expected**: Indicator moves to the correct new position.
6. Pan/zoom Tab B's canvas. **Expected**: The remote cursor stays at the same canvas location (world coords preserved).
7. Check Tab A. **Expected**: Tab A does NOT show its own cursor as a remote overlay (AC-3).

## Scenario 2: Cursor disappears on leave (AC-5)

1. Two tabs in the same room with cursors visible.
2. Close Tab A.
3. **Expected**: Tab A's cursor overlay disappears from Tab B within ~200 ms.

## Scenario 3: Throttle (AC-6)

1. Open browser DevTools → Network → WS tab.
2. Move mouse continuously in the canvas for 1 second.
3. **Expected**: At most ~30 `cursor-move` messages emitted during that second.

## Scenario 4: Rooms are isolated (AC-4)

1. Create Room A in Tab A. Create Room B in Tab B (different URL).
2. Move cursor in Tab A.
3. **Expected**: No cursor event appears in Tab B (different room).

## Scenario 5: Online users panel (AC-8, AC-9, AC-10, AC-11)

1. Open Room URL in Tab A alone. **Expected**: Online panel shows 1 user (self).
2. Open same URL in Tab B. **Expected**: Both tabs' panels update to show 2 users.
3. Close Tab A. **Expected**: Tab B's panel drops to 1 user within ~200 ms.

## Verify no interference (SC-005)

1. With remote cursors visible, try to draw a shape / select / pan.
2. **Expected**: All interactions work normally; cursor overlays do not capture clicks.
