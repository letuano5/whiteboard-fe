# Data Model: P1B-01 Rotate + Resize for Rotated Shapes

## Element (no schema change)

`Element.angle: number` already exists in `src/types/shared.ts`. Phase 1A constrained it to `0`. Phase 1B lifts that constraint — any radian value is now valid; it is normalized to `[-π, π]` on commit.

No new fields added to `Element`.

## InteractionState (additive change)

Add one field to `InteractionState` in `src/types/interaction.ts`:

```ts
interface InteractionState {
  // ... existing fields unchanged ...
  isRotating: boolean;   // NEW — true while a rotate-handle drag is in progress
}
```

Default value: `false`.

Corresponding action added to `interaction.store.ts`:
```ts
setIsRotating: (v: boolean) => void;
```

**Invariant**: `isRotating` and `resizeSession !== null` are mutually exclusive — a drag is either a resize or a rotate, never both.

## ResizeSession (no change)

`ResizeSession.anchor: Point` is computed by `getResizeAnchor` in local (unrotated) element coordinates. This is already correct for rotated resize — see `research.md § Decision 2`.

## New geometry utility (src/utils/geometry.ts)

Pure functions, no state:

```ts
// Rotate point `pt` around `center` by `angle` radians (counter-clockwise).
rotatePoint(pt: Point, center: Point, angle: number): Point

// Un-rotate: equivalent to rotatePoint with -angle.
unrotatePoint(pt: Point, center: Point, angle: number): Point
```

Used in:
- `select-tool.ts` — convert world pointer to element-local space for hit-test and resize.
- Tests — verify correctness of coordinate transforms.
