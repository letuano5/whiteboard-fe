# Quickstart Validation Guide: Local Undo / Redo (P1B-06)

## Prerequisites

- Dev server running: `pnpm dev` (port 5173)
- Modern Chromium or Firefox browser

## Manual Validation Scenarios

### Scenario 1 — Undo create (AC-1)

1. Select a draw tool, draw a rectangle on the canvas
2. Press **Ctrl+Z** (Win/Linux) or **Cmd+Z** (Mac)
3. **Expected**: the rectangle disappears from the canvas

### Scenario 2 — Undo move (AC-2)

1. Draw a shape at position A
2. Drag the shape to position B (mouse up = commit)
3. Press **Ctrl/Cmd+Z**
4. **Expected**: shape returns to position A

### Scenario 3 — Undo delete (AC-4)

1. Draw a shape, select it, press **Delete** key
2. Press **Ctrl/Cmd+Z**
3. **Expected**: the shape reappears

### Scenario 4 — Redo (AC-7)

1. Draw a shape → press Ctrl/Cmd+Z (shape gone)
2. Press **Ctrl+Shift+Z** (Win/Linux) or **Cmd+Shift+Z** (Mac)
3. **Expected**: shape reappears

### Scenario 5 — Redo cleared by new action (AC-9)

1. Draw shape A → Ctrl/Cmd+Z (gone)
2. Draw shape B
3. Press Ctrl/Cmd+Shift+Z
4. **Expected**: nothing happens (redo stack empty)

### Scenario 6 — Empty stack is safe (AC-6, AC-8)

1. Fresh canvas (no actions)
2. Press Ctrl/Cmd+Z repeatedly
3. **Expected**: no error, canvas unchanged

### Scenario 7 — Multi-step (AC-10)

1. Draw shapes 1, 2, 3, 4, 5
2. Press Ctrl/Cmd+Z five times
3. **Expected**: shapes disappear in reverse order (5→4→3→2→1)

### Scenario 8 — Text input guard (AC-15)

1. Double-click a shape to enter text editing mode
2. Press Ctrl+Z while typing
3. **Expected**: browser's native text undo (within the editor), NOT canvas undo

## Running Unit Tests

```bash
pnpm test src/store/__tests__/history.store.test.ts
```

All 15 ACs must have a passing `@covers AC-n` test. Run coverage guard:

```bash
bash scripts/check-ac-coverage.sh
```
