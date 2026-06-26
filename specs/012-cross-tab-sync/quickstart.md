# Quickstart Validation Guide: Cross-Tab Sync

## Prerequisites

- Dev server running: `pnpm dev`
- Two browser tabs open to `http://localhost:5173`

## Manual Validation Scenarios

### Scenario 1 — Basic sync (AC-1 to AC-4)

1. In **Tab A**: select the Rectangle tool and draw a shape.
2. **Tab B** should display the same shape within ~100 ms (no refresh).
3. In **Tab A**: move the shape (drag it).
4. **Tab B** should show the shape at the new position.
5. In **Tab A**: delete the shape (Del key).
6. **Tab B** should remove the shape from the canvas.

### Scenario 2 — Style sync (AC-4)

1. In **Tab A**: draw a rectangle, change its fill color in the detail panel.
2. **Tab B** should show the updated fill color.

### Scenario 3 — Persistence after reload (AC-12)

1. In **Tab A**: draw a shape.
2. Verify it appears in **Tab B**.
3. Close **Tab A**.
4. Reload **Tab B**.
5. The shape should still be on the canvas (persisted to localStorage).

### Scenario 4 — No self-echo (AC-13)

1. In **Tab A**: create a shape.
2. Open browser DevTools → Application → BroadcastChannel (or monitor with console).
3. Verify no second application of the same shape occurs in **Tab A** itself.

## Automated Test Validation

```bash
pnpm test src/sync/__tests__/apply-remote.test.ts
pnpm test src/sync/__tests__/broadcast-channel.test.ts
```

All tests should pass. The `@covers AC-n` tags in each test file map to `acceptance.md`.

## AC Coverage Check

```bash
scripts/check-ac-coverage.sh
```

Expected output: all 14 AC-n IDs covered.
