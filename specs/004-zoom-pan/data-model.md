# Data Model — Zoom + Pan + Infinite Canvas

**Date**: 2026-06-24

## Existing entities (unchanged)

### Camera (committed state — `camera.store.ts`)

```ts
interface Camera {
  x: number;    // world-space offset (pan X)
  y: number;    // world-space offset (pan Y)
  zoom: number; // scale factor, clamped to [0.1, 8]
}
```

**Mutations used by this feature** (all already implemented):
- `zoomTo(zoom, pivot?)` — updates zoom + adjusts x/y so pivot stays fixed
- `panBy(dx, dy)` — adds (dx, dy) to (x, y) in world units

**Constants** (already in `utils/camera.ts`):
```ts
MIN_ZOOM = 0.1
MAX_ZOOM = 8
```

## New transient state (component-local — NOT in any store)

### Pan drag ref (inside Whiteboard.tsx)

```ts
const panStart = useRef<{ x: number; y: number } | null>(null);
// Set on pointerdown (hand tool / middle mouse / space+drag)
// Cleared on pointerup / pointercancel
```

This is a `useRef` (not useState) to avoid re-renders on every pointer-move during panning.

### Space-down state (inside Whiteboard.tsx)

```ts
const [spaceDown, setSpaceDown] = useState(false);
// true while Space key is held AND no text input has focus
// Controls temporary pan mode and cursor display
```

## State not needed

- No new fields added to `elements.store.ts` (Principle I & VI compliance)
- No new fields added to `interaction.store.ts` — pan drag is local to Whiteboard
- `tool` field from `interaction.store.ts` is read (not written) by pan logic
