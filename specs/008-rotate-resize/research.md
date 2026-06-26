# Research: P1B-01 Rotate + Resize for Rotated Shapes

**Date**: 2026-06-24
**Status**: Complete — no external research required; all decisions derived from codebase analysis.

## Design Decisions

### Decision 1: Where to apply un-rotate for hit-test

**Decision**: Un-rotate the query point in the **caller** (`select-tool.ts → onSelectPointerDown`) before calling `ShapeUtil.hitTest`, rather than in each ShapeUtil.

**Rationale**: Un-rotation is a universal operation applied identically to every shape type. Moving it to each ShapeUtil would duplicate the same 3-line transform in every hitTest method. Keeping it in the caller is DRY and avoids violating "type-specific branching in core" in reverse (putting universal logic in type modules).

**Alternatives considered**:
- Per-ShapeUtil un-rotation: rejected — code duplication across ≥5 shape types.
- Wrapper in ShapeUtil registry lookup: rejected — adds indirection with no benefit over caller-side un-rotation.

---

### Decision 2: Resize coordinate frame for rotated shapes

**Decision**: Un-rotate the world pointer around the original bbox center before feeding it to `resizeBoundsFromAnchorAndPointer`. The anchor computed by `getResizeAnchor` is already in local (unrotated) element coordinates.

**Rationale**: `getResizeAnchor` returns coordinates in the element's local frame (`el.x`, `el.y`, etc.), not world space. When `angle = 0`, local = world so the existing code works. For `angle ≠ 0`, converting the world pointer to local space by un-rotating around the stored original center makes both anchor and pointer co-located in local space — the existing resize math applies unchanged.

**Alternatives considered**:
- Delta-based resize (accumulate dx/dy in local axes): rejected — the current implementation is anchor-based and changing the paradigm would require a larger rewrite.
- Store anchor in world space and un-rotate differently: rejected — complicates the existing clean math.

---

### Decision 3: Rotate handle interaction state

**Decision**: Add `isRotating: boolean` to `InteractionState`. Reuse `draggingId` and `dragStart` for the element being rotated and the initial pointer position.

**Rationale**: Minimal state addition. The rotate interaction is mutually exclusive with move and resize (both of which also use `draggingId`). A boolean flag is the simplest discriminant.

**Alternatives considered**:
- Repurpose `resizeHandle` to accept `'rotate'`: rejected — `resizeHandle: ResizeHandleId | null` is typed to exclude `'rotate'` by design; changing this type ripples through the codebase unnecessarily.
- Separate `rotateSession` struct: rejected — the only additional data needed beyond `draggingId`/`dragStart` is the element's original angle, which can be read from the element store at drag start.

---

### Decision 4: Rotate handle visual position and routing

**Decision**: The rotate handle renders inside `SelectionOverlay` as a circle at `(cx, y - ROTATE_HANDLE_OFFSET)` in local space, included in the rotation `<g transform>` so it moves with the shape. The `onHandlePointerDown` prop type is widened to `HandleId` (which already includes `'rotate'`). `Whiteboard.tsx` routes `handle === 'rotate'` to a new `onRotateHandlePointerDown` function.

**Rationale**: Putting the rotate handle inside the rotated `<g>` is a 0-cost positioning strategy — it automatically appears above the rotated top edge without any trigonometry in the overlay component. `HandleId` already includes `'rotate'` in `src/types/interaction.ts`, so the type exists and is merely unused.

**Alternatives considered**:
- Separate `onRotateHandlePointerDown` prop on `SvgLayer`: rejected — doubles the callback surface; routing in `Whiteboard.tsx` is cleaner.

---

### Decision 5: Line shape rotation rendering

**Decision**: Wrap the line's `<polyline>` / `<line>` in a `<g transform={rotate(angle, cx, cy)}>` element, matching the pattern already used by rectangle, ellipse, text, and diamond.

**Rationale**: The other four shapes already apply `transform={angle !== 0 ? `rotate(...)` : undefined}` directly on their SVG element. The line is the only shape that doesn't; adding the same wrapper (on a `<g>`) brings it in line.

**Alternatives considered**:
- Bake rotation into `props.points` on rotate commit: rejected — would make `angle` field redundant for line and create inconsistency with other shapes; also breaks hit-test symmetry.

---

## Codebase Inventory (relevant to this feature)

| File | Relevant to |
|------|-------------|
| `src/types/interaction.ts` | `HandleId` (includes `'rotate'`), `ResizeHandleId`, `InteractionState`, `ResizeSession` |
| `src/store/interaction.store.ts` | Needs `isRotating: boolean` + `setIsRotating` |
| `src/canvas/tools/select-tool.ts` | Hit-test loop, resize loop, pointer move/up — all need rotation awareness |
| `src/canvas/layers/SvgLayer.tsx` | `SelectionOverlay` — add rotation transform + rotate handle |
| `src/canvas/Whiteboard.tsx` | Route `handle === 'rotate'` to new handler |
| `src/canvas/shapes/line.tsx` | Add `<g transform>` wrapper for rotation rendering |
| `src/canvas/shapes/rectangle.tsx` | Hit-test only (render already correct) |
| `src/canvas/shapes/ellipse.tsx` | Hit-test only (render already correct) |
| `src/canvas/shapes/text.tsx` | Hit-test only (render already correct) |
| `src/canvas/shapes/diamond.tsx` | Hit-test only (render already correct) |
| `src/utils/geometry.ts` | **New file** — `rotatePoint` / `unrotatePoint` |
