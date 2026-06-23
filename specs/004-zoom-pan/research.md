# Research Notes — Zoom + Pan + Infinite Canvas

**Date**: 2026-06-24

## No external research required

All implementation uses:
- Standard browser APIs (WheelEvent, PointerEvent, KeyboardEvent) — stable, well-known
- Existing in-repo camera.store.ts and camera utils — already implemented and tested
- React 19 hooks (useRef, useEffect, useState) — already used throughout the codebase
- No new npm packages needed

## Key design decisions

### Decision 1: Zoom factor per scroll tick
- **Chosen**: Fixed multiplicative step — `factor = 1.1`; scroll up → `zoom * factor`; scroll down → `zoom / factor`
- **Rationale**: Produces consistent perceptual zoom increments regardless of deltaY magnitude variance across devices/OS; easy to test deterministically.
- **Alternatives**: deltaY-proportional (`zoom * (1 - deltaY * k)`) — harder to test; perceived step varies across trackpad vs mouse.

### Decision 2: Pan drag state location
- **Chosen**: `useRef<{x:number, y:number} | null>` inside Whiteboard.tsx (component-local ref)
- **Rationale**: Pan drag origin is purely transient within a single pointer capture session; no other component needs it; Constitution Principle VII says transient state stays local. A ref avoids re-renders on pointer-move.
- **Alternatives**: `interaction.store.ts` field — adds permanent store API for a single-component concern; overkill.

### Decision 3: Space-key pan vs text input focus
- **Chosen**: Check `document.activeElement` tag + contentEditable on `keydown`; suppress pan if focused element is INPUT / TEXTAREA / SELECT / contentEditable.
- **Rationale**: Same pattern already used in Whiteboard.tsx for `onSelectKeyDown` guard.

### Decision 4: Hand-tool code location
- **Chosen**: Inline in Whiteboard.tsx (no new file)
- **Rationale**: The handler is 3 small functions (pointerDown, pointerMove, pointerUp). Creating `src/canvas/tools/hand-tool.ts` would add a file for <30 lines and no reuse. Follow existing pattern: select-tool.ts and create-shape-tool.ts are separate because they're larger and have their own state; hand pan is trivially small.

### Decision 5: Cursor style
- **Chosen**: Apply `cursor: grab` on the SVG element when tool=hand or spaceDown; `cursor: grabbing` while pointer is captured (panning).
- **Rationale**: Standard UX convention; implemented via inline style on the `<svg>` element driven by component state.
