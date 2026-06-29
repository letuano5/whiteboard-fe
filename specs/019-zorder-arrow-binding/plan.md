# Implementation Plan: Z-order UI & Arrow Binding

**Branch**: `feat/online-room` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/019-zorder-arrow-binding/spec.md`

## Summary

Implement P2.5-02 (Z-order UI) and P2.5-03 (Arrow Binding) on the existing React/Zustand/Socket.IO
whiteboard canvas.

**Z-order UI**: Exposes four stacking-order commands (Bring to Front / Send to Back / Forward /
Backward) through a right-click context menu. Each command reassigns integer `zIndex` values on the
affected element(s) via `updateElements` (the single mutation pipeline), which then broadcasts the
change to all clients through the existing socket hook.

**Arrow Binding**: When an arrow endpoint is released within a 20-pixel snap threshold of a shape,
the endpoint snaps to the nearest attachment point (centre or four edge midpoints) and a binding
reference (`"elementId:pointKey"`) is saved in `props.startBinding` / `props.endBinding`. A
mutation hook watches for shape moves and resizes and updates all bound arrow endpoints in the same
pipeline call, so arrows follow their bound shapes automatically. Undo covers all operations.

---

## Technical Context

**Language/Version**: TypeScript 6.x (strict), Node 22 LTS
**Primary Dependencies**: React 19, Zustand 5, Socket.IO 4.8 (client + server), Vite 8
**Storage**: In-memory only (no persistence changes in this feature)
**Testing**: Vitest 4 (frontend unit tests)
**Target Platform**: Browser (SVG/DOM rendering, no Canvas changes)
**Project Type**: Web application (monorepo — changes are frontend-only)
**Performance Goals**: Z-order change and context menu response < 16 ms (single frame); arrow snap
detection on every pointerMove over threshold shapes (~60 fps budget already met by select tool)
**Constraints**: `zIndex` integer only (no fractional indexing — constitution constraint); binding
encoded as plain `string | null` (no shared-type schema change needed); no new WS events

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Unified Element Store — renderer holds no state | ✅ | `zIndex` and binding fields live in `elements.store.ts`; context menu is pure UI with no local state |
| II | Element Versioning — `version++`, new `versionNonce`, `updatedAt` on every mutate | ✅ | All z-order and binding changes go via `patchElement` / `updateElements` which handle versioning |
| III | Shared Camera Transform — all layers use `camera.store.ts` + `screenToWorld`/`worldToScreen` | ✅ | Snap threshold computed in world coords via existing `screenToWorld`; context menu positioned in screen coords (DOM overlay, not SVG) |
| IV | ShapeUtil Strategy — no type branching in core; new shape = new ShapeUtil only | ✅ | Snap attachment-point helpers live in `arrow-binding.ts` (standalone utility), not in the core canvas or select-tool; arrow ShapeUtil is not changed |
| V | Sync Data Not Renderer — only `Element[]` crosses boundaries | ✅ | `zIndex` and `startBinding`/`endBinding` are already in the `Element` schema; no renderer state is broadcast |
| VI | Single Mutation Pipeline — `createElement`/`patchElement`/`deleteElements`/`updateElements` only | ✅ | Z-order operations call `updateElements`; binding snap calls `patchElement`; cascade updates call `updateElements`; all through the pipeline |
| VII | Committed vs Transient State — `elements.store` and `interaction.store` stay separate | ✅ | Snap preview during arrow draw is stored in `interaction.store` (draftElement); committed binding is written only on pointerUp via pipeline |

No violations. No complexity tracking needed.

---

## Project Structure

### Documentation (this feature)

```text
specs/019-zorder-arrow-binding/
├── plan.md          ← this file
├── research.md      ← Phase 0 output
├── data-model.md    ← Phase 1 output
├── quickstart.md    ← Phase 1 output
├── contracts/       ← Phase 1 output (no new WS events — doc existing element-update schema)
└── tasks.md         ← Phase 2 output (/speckit-tasks)
```

### Source Code (affected files)

```text
frontend/src/
├── canvas/
│   ├── shapes/
│   │   └── arrow-binding.ts          ← NEW: attachment point helpers + snap detection
│   ├── tools/
│   │   ├── create-shape-tool.ts      ← MODIFY: add binding snap on arrow pointerUp
│   │   └── select-tool.ts            ← MODIFY: add binding snap on arrow endpoint resize; cascade update on shape move
│   └── layers/
│       └── SvgLayer.tsx              ← MODIFY: add onContextMenu handler + snap indicator for bound endpoints
├── components/
│   └── context-menu/
│       ├── ContextMenu.tsx           ← NEW: floating right-click menu with z-order commands
│       └── __tests__/
│           └── ContextMenu.test.tsx  ← NEW: unit tests (AC-1..AC-7)
├── store/
│   └── zorder.ts                     ← NEW: bringToFront / sendToBack / bringForward / sendBackward
└── sync/
    └── arrow-binding-hook.ts         ← NEW: mutation hook — cascade arrow endpoint updates on shape move/resize

frontend/src/canvas/shapes/__tests__/
└── arrow-binding.test.ts             ← NEW: unit tests (AC-8..AC-16)

frontend/src/store/__tests__/
└── zorder.test.ts                    ← NEW: unit tests (AC-1..AC-7)
```

Backend: **no changes** — `element-update` already relays all `Element` fields including `zIndex`
and `props.startBinding`/`props.endBinding`.

---

## Phase 0 — Research

Findings compiled in [research.md](./research.md).

Key resolved decisions:

1. **Binding encoding**: `"elementId:pointKey"` plain string stored in `props.startBinding` /
   `props.endBinding` (already `string | null` in shared types). No schema change needed. Arrow
   rendering uses `props.points` for geometry; binding is metadata that triggers updates.

2. **Snap cascade strategy**: A `registerMutationHook` callback (`arrow-binding-hook.ts`) watches
   every `patch` / `update` event and, for each non-arrow element that changed position or size,
   computes the new endpoint positions for bound arrows and calls `updateElements`. This fires
   within the same microtask as the originating mutation, preventing visual lag.

3. **Context menu positioning**: DOM `<div>` absolutely positioned using `clientX/clientY` from the
   `contextmenu` event. Uses a `useEffect` click-outside listener to dismiss. SVG approach is
   rejected because `<foreignObject>` is harder to clip correctly.

4. **Z-order algorithm**: Integer `zIndex` values are assigned sparsely (no full-array reassignment).
   For "Bring to Front": target gets `max(all zIndex) + 1` (only target updated).
   For "Send to Back": target gets `min(all zIndex) - 1` (only target updated).
   For "Forward"/"Backward": target and its immediate neighbour swap their `zIndex` values (two
   elements updated). All four operations call `updateElements` with only the actually-changed
   elements. Tie-breaking when two shapes are equidistant from an arrow endpoint: the shape with
   the higher `zIndex` wins.

5. **Snap threshold**: 20 world-coordinate pixels (constant `ARROW_SNAP_THRESHOLD = 20`). World
   coords are used so the snap distance is view-independent (does not expand when zoomed out).

6. **Arrow endpoint handle**: Arrow endpoints are currently exposed as bounding-box resize handles
   (nw/se or n/s/e/w). After resize pointerUp, we check the moved endpoint world position against
   nearby shapes. The `arrow-binding.ts` helper identifies which endpoint (start or end) moved and
   updates the binding field accordingly.

---

## Phase 1 — Design

### Data model

See [data-model.md](./data-model.md) for entity details.

**Binding string format** (no new type exported from `@vdt/shared`):

```
startBinding: "rec_abc123:center"    // bound to element rec_abc123 at its centre
endBinding:   "rec_abc123:top"       // bound at shape's top-edge midpoint
endBinding:   null                   // unbound
```

`pointKey` values: `"center" | "top" | "right" | "bottom" | "left"`

**Attachment point world positions** (from an element `el`):

| pointKey  | x                   | y                   |
|-----------|---------------------|---------------------|
| center    | el.x + el.width/2   | el.y + el.height/2  |
| top       | el.x + el.width/2   | el.y                |
| right     | el.x + el.width     | el.y + el.height/2  |
| bottom    | el.x + el.width/2   | el.y + el.height    |
| left      | el.x                | el.y + el.height/2  |

### Contracts

See [contracts/element-update.md](./contracts/element-update.md). No new WS events. The existing
`element-update` event already carries the full element payload including `zIndex` and
`props.startBinding`/`props.endBinding`.

### Validation

See [quickstart.md](./quickstart.md) for runnable end-to-end validation scenarios.

### Agent context update

CLAUDE.md updated to reference this plan file at `specs/019-zorder-arrow-binding/plan.md`.
