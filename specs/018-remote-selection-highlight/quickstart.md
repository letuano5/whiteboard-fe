# Quickstart Validation Guide: Remote Selection Highlight & Draft Preview (P2.5-04)

**Date**: 2026-06-28

## Prerequisites

- pnpm installed (v10+)
- Node 22 LTS
- Two browser windows (or tabs) open to the same room URL

## Start the app

```bash
pnpm dev:all
```

Backend starts on `http://localhost:3001`. Frontend on `http://localhost:5173`.

Open two windows to `http://localhost:5173/?room=<any-uuid>`.

---

## Scenario 1 — Remote selection highlight (AC-1 to AC-5)

**Setup**: Two windows (A and B) in the same room.

1. In window A, click the select tool and click on any element.
2. **Expected in window B**: A solid colored border appears around that element, using A's user color (visible in the online-users panel). No resize handles, no rotate handle.
3. In window A, drag-select multiple elements (marquee).
4. **Expected in window B**: All selected elements get the colored border.
5. In window A, click on empty canvas to deselect.
6. **Expected in window B**: The colored border disappears.
7. Open a third window C in the same room. Select a different element in C.
8. **Expected in window B**: Both A's and C's selections are visible simultaneously, each in their own color.
9. Close window A.
10. **Expected in window B**: A's selection highlight disappears.

---

## Scenario 2 — Remote draft preview during drag (AC-6 to AC-10)

**Setup**: Two windows (A and B) in the same room with at least one element on the canvas.

1. In window A, select an element and begin dragging it (hold mouse/pointer down, move).
2. **Expected in window B**: The element appears to follow A's drag in real time, at ~50% opacity or with a distinguishing visual style.
3. In window A, release the pointer (commit).
4. **Expected in window B**: The ghost disappears and the element snaps to its final position at full opacity.
5. In window A, start dragging an element, then press **Escape** to cancel.
6. **Expected in window B**: The ghost disappears and the element returns to its original position.

---

## Scenario 3 — Remote draft during resize (AC-7 variant)

1. In window A, select an element and drag a resize handle.
2. **Expected in window B**: The element resizes live as a ghost.
3. In window A, release (commit).
4. **Expected in window B**: Final committed size replaces the ghost.

---

## Scenario 4 — Remote draft during shape creation (AC-8)

1. In window A, choose the rectangle tool and draw a new shape (drag to create).
2. **Expected in window B**: A ghost rectangle appears and grows as A draws.
3. In window A, release to commit.
4. **Expected in window B**: The committed shape appears at full opacity.

---

## Automated tests to run

```bash
# Unit tests
pnpm --filter whiteboard-fe test

# Type check all packages
pnpm typecheck
```

Key test files to check or add:
- `frontend/src/sync/__tests__/socket-client.test.ts` — verify `selectedIds` is included in cursor-move emission and `element-draft` is emitted/received
- `frontend/src/canvas/layers/__tests__/SvgLayer.test.tsx` — verify remote selection highlights and draft ghosts render

## Verification checklist

- [ ] Remote selection border uses peer's `color` from `Presence`
- [ ] Remote selection border is visually distinct from local selection (no handles)
- [ ] Simultaneous multi-user selections visible (each in their color)
- [ ] Draft ghost appears at ≤ 150 ms after peer starts drag
- [ ] Draft ghost disappears when peer commits or disconnects
- [ ] `remoteDrafts` in `interaction.store` is never written to `elements.store`
- [ ] `element-draft` event is NOT relayed as `element-update` (check server logs / network tab)
- [ ] TypeScript: `strict: true` — no `any`, no type errors
