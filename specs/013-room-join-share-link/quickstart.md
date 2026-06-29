# Quickstart Validation Guide — Room Join & Share Link

## Prerequisites

```bash
pnpm install
pnpm dev:all   # starts frontend (5173) + backend (3001) in parallel
```

## Scenario 1 — Home screen (AC-1)

1. Open `http://localhost:5173/` (no query string).
2. **Expected**: Home/landing screen is displayed — NOT the canvas.

## Scenario 2 — Create new room (AC-2)

1. From the home screen, click "Create new room".
2. **Expected**: URL changes to `http://localhost:5173/?room=<uuid>` and the canvas is displayed.

## Scenario 3 — Rejoin via URL (AC-3)

1. Copy the room URL from Scenario 2.
2. Open a new tab and paste the URL.
3. **Expected**: Canvas loads for that same room (not the home screen).

## Scenario 4 — join-room event (AC-4)

1. Open a room URL.
2. In the browser's DevTools → Network → WS tab, find the Socket.IO connection.
3. **Expected**: `42["join-room",{"roomId":"<uuid>"}]` frame is sent immediately after connection.

## Scenario 5 — Room broadcast (AC-5)

1. Open the same room URL in two browser tabs (Tab A and Tab B).
2. In Tab A, draw a rectangle.
3. **Expected**: The rectangle appears in Tab B within ~200 ms.

## Scenario 6 — Room isolation (AC-6)

1. Open room `/room-A` in Tab A and room `/room-B` in Tab B.
2. Draw a shape in Tab A.
3. **Expected**: Tab B does NOT receive or display that shape.

## Scenario 7 — Copy share link (AC-7 + AC-8)

1. Inside a room, click the "Copy link" / share button.
2. **Expected**: The current room URL is in the clipboard; the button briefly shows "Copied!" or similar feedback.
