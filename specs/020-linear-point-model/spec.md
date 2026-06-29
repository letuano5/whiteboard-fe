# Feature Specification: Point-Based Model for Linear Elements

**Feature Branch**: `020-linear-point-model`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "P2.5-05: Point-based model cho linear elements (arrow, line, freehand)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bounds Always Match Points (Priority: P1)

A developer (or end-user) selects an arrow/line on the canvas. The selection box (bounding box)
visually matches exactly the extent of the drawn line — there is no gap or mis-alignment between
the visible element and its selection region.

**Why this priority**: The bounding box is the foundation of hit-test, selection, binding, and
zoom-to-content. If it diverges from actual points the entire interaction layer is unreliable.

**Independent Test**: Create an arrow, verify its selection highlight tightly wraps both endpoints.

**Acceptance Scenarios**:

1. **Given** an arrow element exists, **When** its bounding box is computed via `getBounds`, **Then** the box equals the axis-aligned bounding box of `props.points` (not `x,y,width,height` stored independently).
2. **Given** a line element whose stored `x,y,width,height` diverges from its `props.points`, **When** `getBounds` is called, **Then** the returned bbox is derived from `props.points` exclusively.

---

### User Story 2 - Mutation Pipeline Normalises Bounds (Priority: P1)

Any time an arrow or line is created, moved, or its points are changed, the stored `x`,`y`,`width`,`height` fields are automatically kept in sync with the point cloud — no manual bookkeeping required.

**Why this priority**: Prevents the "two sources of truth" problem at its root; required before
the endpoint-handle UX can work reliably.

**Independent Test**: Mutate an arrow's points via the store pipeline and inspect the stored element — bounds must match points.

**Acceptance Scenarios**:

1. **Given** a mutation that changes `props.points` of an arrow, **When** the mutation is committed through the pipeline, **Then** `x,y,width,height` on the stored element equal the bbox of the updated `props.points`.
2. **Given** a new arrow is created, **When** the element is written to the store, **Then** its `x,y,width,height` derive from `props.points` and `normalizeLinearBounds` has been applied.

---

### User Story 3 - Endpoint Handle Interaction (Priority: P2)

When the user selects an arrow or line, they see two circular handles — one at each endpoint —
instead of the usual 8 corner/edge resize handles. Dragging a handle moves only that endpoint.

**Why this priority**: The 8-handle bbox resize is meaningless for a 2-point linear element and
produces visually broken results. Endpoint handles are the correct UX.

**Independent Test**: Select an arrow; drag its start handle to a new position; release and verify only the start point moved.

**Acceptance Scenarios**:

1. **Given** an arrow is selected, **When** the selection overlay renders, **Then** exactly two endpoint handles (circles) are shown at the positions of `props.points[0]` and `props.points[1]`, and no corner/edge bbox handles are shown.
2. **Given** the user drags the start endpoint handle, **When** pointer is released, **Then** `props.points[0]` is updated to the dropped position and the arrow redraws accordingly.
3. **Given** the user drags the end endpoint handle over a shape that accepts bindings, **When** pointer is released, **Then** the binding snaps and `endBinding` is set correctly (existing binding logic unchanged).

---

### User Story 4 - Bound Arrow Follows Dragged Shape (Priority: P2)

When a shape with a bound arrow is dragged, the arrow visually follows in real-time during
the drag gesture — it does not wait until the pointer is released.

**Why this priority**: Without this, the canvas feels laggy and disconnected during drag. This is the main UX regression that motivated the whole feature.

**Independent Test**: Bind an arrow to a rectangle; drag the rectangle; verify the arrow re-routes continuously while dragging.

**Acceptance Scenarios**:

1. **Given** a rectangle has an arrow whose `startBinding` targets it, **When** the rectangle is being dragged (pointer still held), **Then** the arrow is included in the draft elements with updated points so it moves alongside the rectangle.
2. **Given** the user releases the pointer after the drag, **When** the mutation is committed, **Then** the final arrow position matches its position at pointer-up.

---

### User Story 5 - Hit-Test and Undo Unaffected (Priority: P3)

Existing hit-test (clicking near an arrow selects it) and undo/redo behaviour continue to work
exactly as before after the refactor.

**Why this priority**: Regression prevention — these are existing features that must not break.

**Independent Test**: After the refactor, click on an arrow; undo a point change; redo it.

**Acceptance Scenarios**:

1. **Given** an arrow exists, **When** the user clicks within the hit-test region of the arrow shaft, **Then** the arrow is selected.
2. **Given** the user dragged an endpoint, **When** the user triggers undo, **Then** the endpoint returns to its previous position and the arrow redraws correctly.

---

---

### User Story 6 - Bound Arrow Follows During Resize and Rotate (Priority: P2)

When a shape is being **resized** or **rotated**, any bound arrow must track the shape's
attachment points in real-time (draft layer), just like it does during drag. Additionally,
attachment points must be computed at their **rotated world position** — not at the
axis-aligned bbox position.

**Why this priority**: Without this, resizing/rotating a shape makes the arrow jump to
the correct position only on pointer-up, creating a jarring visual disconnect.

**Independent Test**: Bind an arrow to a rectangle; resize the rectangle; verify the arrow
follows the attachment point continuously during the resize. Then rotate the rectangle; verify
the arrow connects to the geometrically-rotated edge point.

**Acceptance Scenarios**:

1. **Given** a shape with a bound arrow is being resized (pointer held), **When** the pointer
   moves, **Then** the arrow is included in `draftElements` with points computed from the
   resized draft shape — same behaviour as drag.
2. **Given** a shape is rotated to `angle ≠ 0` and has a bound arrow at the `'top'` point,
   **When** the shape's angle changes, **Then** the arrow's endpoint is at the **rotated** top
   position (not the un-rotated axis-aligned top).
3. **Given** a shape has `angle = 45°` and a binding at `'right'`, **When** `computeBindingPoint`
   is called, **Then** it returns a point rotated 45° around the shape's center relative to the
   un-rotated right-edge midpoint.

---

### User Story 7 - Fully-Bound Arrow Cannot Be Moved by Body Drag (Priority: P2)

An arrow that has both `startBinding` and `endBinding` is entirely anchored by its source
shapes. Allowing the user to drag the arrow body independently would conflict with the
bindings and result in stale point positions.

**Why this priority**: Moving a fully-bound arrow makes no semantic sense and confuses users
who expect the arrow to always track its bound shapes.

**Independent Test**: Bind both ends of an arrow to two different shapes; attempt to drag the
arrow body; verify it does not move. Click the arrow to confirm it is still selectable.

**Acceptance Scenarios**:

1. **Given** an arrow has both `startBinding` and `endBinding` set, **When** the user clicks
   on the arrow body without shift, **Then** the arrow is selected but no drag session starts.
2. **Given** a fully-bound arrow is selected, **When** the user holds the pointer down on the
   arrow body and moves, **Then** the arrow stays in place (no `draggingId` is set).
3. **Given** a fully-bound arrow is selected, **When** the user drags one of its endpoint handles,
   **Then** the endpoint can be moved and re-bound (endpoint handles remain interactive).

---

### Edge Cases

- What happens when `props.points` is empty or has only one point? (Assume guarded — element is invalid and treated as zero-size bbox.)
- What if binding is applied to an arrow while dragging another shape — does normalisation run without creating a loop? (Normalisation runs once at commit, not during draft.)
- Does normalisation affect non-linear element types (rectangle, ellipse, text)? (No — `normalizeLinearBounds` applies only to `arrow` and `line` types.)
- What if a shape with `angle = 0` has bound arrows — are attachment points unchanged? (Yes — the rotation path is skipped when `angle === 0`; no behaviour change for non-rotated shapes.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `getBounds` for `arrow` and `line` ShapeUtils MUST derive the bounding box exclusively from `props.points`, ignoring any stored `x,y,width,height`.
- **FR-002**: The mutation pipeline MUST call `normalizeLinearBounds` (or equivalent inline logic) on every `arrow` and `line` element when committing a mutation, keeping `x,y,width,height` in sync with the convex hull / axis-aligned bbox of `props.points`.
- **FR-003**: The selection overlay MUST render two circular endpoint handles for `arrow` and `line` elements, replacing the eight corner/edge handles.
- **FR-004**: Dragging an endpoint handle MUST update the corresponding entry in `props.points` and MUST NOT move the element's other point or change any binding on the untouched endpoint.
- **FR-005**: When a shape with a bound arrow is being dragged (draft mode / `onSelectPointerMove`), the arrow MUST be included in `draftElements` with its points already recalculated relative to the new shape position.
- **FR-006**: `normalizeLinearBounds` MUST be a pure function: given `props.points`, returns `{ x, y, width, height }` without side effects.
- **FR-007**: Hit-test for `arrow` and `line` MUST continue to use the same geometric test (proximity to the line segment) and MUST NOT rely on the stored bbox for selection.
- **FR-008**: Undo and redo MUST preserve and restore `props.points` correctly; normalised `x,y,width,height` MUST be re-derived on replay.
- **FR-009**: `getAttachmentPoints` and `computeBindingPoint` MUST rotate non-center attachment points around the element's center by `element.angle` when `angle !== 0`, so that binding points reflect the shape's actual rendered (rotated) geometry.
- **FR-010**: When a shape with a bound arrow is being **resized** (draft mode), the arrow MUST be included in `draftElements` with points recalculated from the resized draft bounds — matching the existing behaviour for drag (FR-005).
- **FR-011**: When a shape with a bound arrow is being **rotated** (draft mode), the arrow MUST be included in `draftElements` with points recalculated from the rotated attachment positions (which depend on FR-009).
- **FR-012**: An arrow with both `startBinding` and `endBinding` set MUST NOT start a drag session when the user clicks its body. The arrow remains selectable; endpoint handles remain interactive so the user can still rebind individual endpoints.

### Key Entities

- **LinearElement** (`arrow` | `line`): Element with `props.points: [x,y][]` as source of truth; `x,y,width,height` are derived/normalised fields.
- **EndpointHandle**: Transient UI handle representing one entry in `props.points`; not persisted.
- **draftElements**: Transient per-pointer-move set of elements shown during drag before commit; includes bound arrows.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After the change, selecting any arrow or line shows exactly 2 handles (not 8). Verified by visual inspection and automated rendering test.
- **SC-002**: Dragging a shape with a bound arrow: the arrow visually follows every pointer-move event, not only on pointer-up.
- **SC-003**: All existing undo/redo interactions with arrows and lines pass without regression.
- **SC-004**: Zero divergence between `getBounds` result and the visual stroke extent of any arrow or line, measurable by comparing bbox to endpoints.
- **SC-005**: `normalizeLinearBounds` runs in constant time regardless of element count at the point of mutation.
- **SC-006**: Resizing a shape with a bound arrow: the arrow visually follows on every pointer-move event during resize, not only on pointer-up.
- **SC-007**: Rotating a shape with a bound arrow: the arrow's endpoint stays at the geometrically-correct rotated attachment position throughout the rotation gesture.
- **SC-008**: Clicking and dragging the body of a fully-bound arrow (both endpoints bound) has no effect; the arrow does not move.

## Assumptions

- `freehand` elements are **out of scope** for this feature (they will benefit from the same model in Phase 3C; this spec covers only `arrow` and `line`).
- The existing `startBinding` / `endBinding` snap logic is unchanged; this feature only ensures arrows follow during drag and that bounds are derived from points.
- `props.points` always contains exactly 2 entries for `arrow` and `line` (start and end); multi-segment lines are not in scope.
- The selection overlay component is currently responsible for rendering handles; the endpoint handles are added there without creating a new architectural layer.
- The normalisation step does not need network-level migration: all existing elements will be normalised on first mutation after the change ships.
