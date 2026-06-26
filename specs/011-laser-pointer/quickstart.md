# Quickstart Validation Guide: Laser Pointer (P1B-04)

## Prerequisites

- Dev server running: `pnpm dev`
- Browser open at `http://localhost:5173`

## Validation Scenarios

### Scenario 1 — Basic trail (AC-1, AC-2, AC-3)

1. Click the **Laser** tool button (Zap icon) in the toolbar.
2. Move the mouse slowly over the canvas.
3. **Expect**: A red trail appears following the cursor.
4. Stop moving the mouse.
5. **Expect**: After ~1 second, the trail begins to fade; after ~1.5 seconds it is gone.
6. Move the mouse again.
7. **Expect**: A new trail starts from the current position.

### Scenario 2 — Toolbar activation (AC-4)

1. Click the **Laser** button in the toolbar.
2. **Expect**: Button is highlighted (blue background); cursor changes to crosshair over the canvas.

### Scenario 3 — Switching away clears trail immediately (AC-5)

1. Activate laser tool and move the mouse to create a visible trail.
2. Immediately click the **Select** tool.
3. **Expect**: Trail disappears instantly (no waiting for timeout).

### Scenario 4 — No elements created (AC-7)

1. Open browser DevTools → Application → Local Storage.
2. Activate laser tool and draw a trail.
3. Let the trail fade out.
4. **Expect**: LocalStorage `elements` key is unchanged (no new entries added).

### Scenario 5 — No persistence after reload (AC-6)

1. Draw a laser trail.
2. Immediately reload the page (Cmd/Ctrl+R).
3. **Expect**: No laser trail visible after reload.

### Scenario 6 — Correct rendering at zoom levels (AC-8)

1. Zoom canvas to 0.1× (minimum) using Ctrl+scroll.
2. Activate laser and move mouse.
3. **Expect**: Trail follows the cursor correctly at that zoom.
4. Zoom to 8× (maximum) and repeat.
5. **Expect**: Trail still aligns with cursor.

## Run Tests

```bash
pnpm test src/canvas/tools/__tests__/laser-tool.test.ts
```

Expected: all tests pass, all AC-1 through AC-8 covered.
