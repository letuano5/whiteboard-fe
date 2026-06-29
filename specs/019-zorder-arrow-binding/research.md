# Research: Z-order UI & Arrow Binding

**Feature**: P2.5-02 + P2.5-03 | **Date**: 2026-06-28

## Decision 1: Binding Encoding Format

**Decision**: Store `"elementId:pointKey"` as a plain string in the existing `props.startBinding` /
`props.endBinding` fields (`string | null`).

**Rationale**: Both fields already exist in `ElementProps` in `@vdt/shared`. No shared-type change
is needed. The format is human-readable and trivially split with `.split(':')`. An alternative of
storing a JSON object was considered and rejected because `string | null` is the current declared
type; changing it to `object | null` would require a shared-type change and a migration path.

**Alternatives considered**:
- JSON object `{ elementId, pointKey }` — cleaner at parse time but requires type change in
  `@vdt/shared` and the serialised form is identical once stored in the `Element`.
- Store only `elementId` (no pointKey) and always snap to the nearest attachment point at render
  time — rejected because the attachment point would shift when the shape changes size, causing
  unexpected arrow behaviour.

---

## Decision 2: Snap Cascade Strategy

**Decision**: Use a `registerMutationHook` callback in `arrow-binding-hook.ts` that fires after
every `patch`/`update` mutation and propagates updated endpoint positions to bound arrows via
`updateElements`.

**Rationale**: The existing `registerMutationHook` API in `mutation-pipeline.ts` provides exactly
this capability. The hook fires synchronously in the same JS task as the source mutation, so there
is zero visual lag. The hook only processes non-arrow elements (and arrows whose binding changed),
so there is no infinite loop risk.

**Alternatives considered**:
- Reacting in `onSelectPointerUp` (select tool) — simpler but would miss programmatic moves (paste,
  undo, remote updates). The mutation hook captures all mutation paths.
- Deriving arrow endpoint positions from bindings at render time (in `arrowShapeUtil.render`) —
  clean in isolation but violates Principle I (renderer must not compute authoritative geometry from
  store state) and complicates hit-testing.

---

## Decision 3: Context Menu Implementation

**Decision**: DOM `<div>` overlay positioned absolutely in screen coordinates using the
`contextmenu` event's `clientX/clientY`. Dismissed by click-outside via a `useEffect` listener.
Rendered via a portal (or top-level div in `Whiteboard.tsx`).

**Rationale**: Browser `contextmenu` events fire reliably on right-click across platforms. A DOM
overlay is easier to style, clip, and animate than an SVG `<foreignObject>`. Screen coordinates
require no camera transform.

**Alternatives considered**:
- Keyboard-only z-order (Ctrl+] / Ctrl+[) without a menu — insufficient discoverability.
- Toolbar secondary button for z-order — requires persistent UI space for an infrequent action.

---

## Decision 4: Z-order Integer Algorithm

**Decision**:
- **Bring to Front**: `target.zIndex = max(allElements.zIndex) + 1`; only one element updated.
- **Send to Back**: `target.zIndex = min(allElements.zIndex) - 1`; only one element updated.
- **Forward**: swap `zIndex` of target and the element immediately above it; two elements updated.
- **Backward**: swap `zIndex` of target and the element immediately below it; two elements updated.

**Rationale**: Integer-only (per constitution). These operations are O(n) in element count, which
is acceptable for canvas sizes typical of this phase. The algorithms are deterministic and produce
the correct render order after `elements.sort((a,b) => a.zIndex - b.zIndex)` in the renderer.

**Alternatives considered**:
- Reassigning all elements' zIndex to be 1..N after each operation — avoids integer drift but
  touches every element, inflating undo history and broadcasting unnecessary updates.
- Fractional indexing — explicitly excluded by constitution Tech Stack Constraints.

---

## Decision 5: Snap Threshold

**Decision**: `ARROW_SNAP_THRESHOLD = 20` world-coordinate pixels (constant, not user-configurable
in this phase).

**Rationale**: World-space threshold means snap distance is zoom-independent. 20px is large enough
to be discoverable at normal zoom levels (100–200%) but small enough to avoid accidental snapping.
This matches common diagramming tools (Excalidraw uses 8–20px depending on the operation).

---

## Decision 6: Arrow Endpoint Detection

**Decision**: Arrow endpoints are the first and last entry in `props.points` (`[0]` = start, `[1]`
= end). When the select tool commits a resize of an arrow, we identify which endpoint moved by
comparing the pointerUp world position to each endpoint and snap only the nearer one to any shape
within threshold. This is implemented in `select-tool.ts` inside `onSelectPointerUp`.

When drawing a new arrow (via `create-shape-tool.ts`), both endpoints are checked on `pointerUp`
before `createElement`.

**Alternatives considered**:
- Map resize handles (nw/se) to endpoint indices — fragile because arrow points are stored
  absolutely and handle-to-endpoint mapping is not invariant under the bounding box normalisation.
  Comparing the raw world position of each endpoint to the pointer is simpler.
