# Research: P1A-03 Move / Resize / Delete

**Date**: 2026-06-23 | **Status**: Complete — no external unknowns

## Summary

All technology choices are established in `CLAUDE.md` and the project constitution.
No new packages. No deprecated APIs involved. Research phase records design decisions only.

## Decision Log

### D1 — Drag lifecycle: commit-only vs live mutation

- **Decision**: Commit-only (Option B). The committed store is updated once on `pointerUp`.
- **Rationale**: Live mutation on every `pointerMove` floods the mutation pipeline and history stack with hundreds of intermediate patches per drag. `create-shape-tool.ts` already uses the same pattern with `draftElement` for live preview.
- **Alternative rejected**: Live mutation (Option A) — would pollute undo history (each undo step would be a tiny sub-pixel move, not a logical "move shape" action).

### D2 — Live preview during drag

- **Decision**: Reuse the existing `draftElement` field in `interactionStore`. During a drag, write the in-flight element copy to `draftElement`; SvgLayer already renders it at 0.6 opacity. On commit, clear `draftElement`.
- **Rationale**: Zero new rendering infrastructure needed; consistent with how shape creation previews work.

### D3 — Handle hit detection

- **Decision**: Attach `onPointerDown` callbacks directly to the 8 handle `<circle>` nodes in `SelectionOverlay`, using `e.stopPropagation()` to prevent body-drag from firing. Pass a single `onHandlePointerDown: (handle: HandleId, e: React.PointerEvent) => void` prop from Whiteboard through SvgLayer.
- **Rationale**: Clean separation — the SVG root's `onPointerDown` handles body-drag; individual circles handle resize. No DOM ID lookups required.

### D4 — Resize anchor geometry (angle = 0)

For each handle, the opposite corner/edge is the **anchor** (fixed point). The dragged corner moves with the pointer. At angle = 0:

| Handle | Anchor x | Anchor y | Width formula | Height formula |
|--------|----------|----------|---------------|----------------|
| nw | x+w | y+h | anchorX − ptrX | anchorY − ptrY |
| ne | x | y+h | ptrX − anchorX | anchorY − ptrY |
| sw | x+w | y | anchorX − ptrX | ptrY − anchorY |
| se | x | y | ptrX − anchorX | ptrY − anchorY |
| n | — | y+h | (unchanged) | anchorY − ptrY |
| s | — | y | (unchanged) | ptrY − anchorY |
| w | x+w | — | anchorX − ptrX | (unchanged) |
| e | x | — | ptrX − anchorX | (unchanged) |

New `x` = `min(ptrX, anchorX)` for handles that affect x-axis; `x = element.x` otherwise.
New `y` = `min(ptrY, anchorY)` for handles that affect y-axis; `y = element.y` otherwise.
Clamp: `width = Math.max(1, computedWidth)`, `height = Math.max(1, computedHeight)`.

### D5 — Delete keyboard handler

- **Decision**: `useEffect` in `Whiteboard.tsx`, listener on `window`, event `keydown`. Check `e.key === 'Delete' || e.key === 'Backspace'` with `selectedIds.length > 0` guard.
- **Rationale**: Consistent with standard whiteboard apps. Window-level listener avoids focus issues with SVG.
- **Cleanup**: Return the `removeEventListener` from the effect.

### D6 — Point-based geometry during move and resize

- **Decision**: Treat the bounding box and `props.points` as one geometry unit. Move translates every absolute point by the drag delta. Resize maps every point from the old bounding box into the new bounding box.
- **Rationale**: Lines render and hit-test from `props.points`; changing only `x`, `y`, `width`, and `height` moves the selection overlay without moving the visible line.
- **Degenerate bounds**: For horizontal or vertical lines whose old width or height is zero, derive the missing-axis ratio from the non-zero axis (or point order for a zero-length geometry) so a resize can turn the line into a diagonal.
