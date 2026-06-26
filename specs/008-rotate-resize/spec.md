# Feature Specification: Rotate + Correct Resize/Hit-Test for Rotated Shapes

**Feature Branch**: `008-rotate-resize`

**Created**: 2026-06-24

**Status**: Draft

**Input**: [P1B-01] Rotate + Resize đúng khi đã xoay

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rotate a Shape (Priority: P1)

A user selects a shape and wants to rotate it by dragging a rotation handle that appears outside the selection bounding box. The shape spins around its center while the user drags, and the final rotation angle is saved when the user releases.

**Why this priority**: Rotation is the primary deliverable of this feature; all other stories depend on shapes having a non-zero angle.

**Independent Test**: Select any shape, drag the rotate handle in a circular motion, release — the shape renders at the new angle and remains rotated after re-selecting it.

**Acceptance Scenarios**:

1. **Given** a shape is selected, **When** a rotate handle is visible above the bounding box, **Then** dragging the handle rotates the shape around its bounding-box center in real time.
2. **Given** a user drags the rotate handle and releases, **When** the drag ends, **Then** `patchElement` is called with the new `angle` (in radians) and the shape is re-rendered at that angle.
3. **Given** a shape with `angle = 0`, **When** the rotate handle is dragged 90° clockwise, **Then** the stored `angle` is approximately `π/2` radians.
4. **Given** any shape type (rectangle, ellipse, line, text), **When** the rotate tool is used, **Then** all types rotate correctly without special-casing in core code.

---

### User Story 2 - Click to Select a Rotated Shape (Priority: P1)

After a shape has been rotated, a user clicks on the visible rendered area of the shape. The click should hit-detect the rotated shape correctly — clicking on the visible body selects it, clicking in the original (un-rotated) axis-aligned bbox area but outside the rotated shape does not falsely select it.

**Why this priority**: Without correct hit-test, the rotate feature is unusable — users cannot select shapes after rotation.

**Independent Test**: Rotate a rectangle 45°, then click on a corner of the rotated diamond — it selects. Click in the corner of the original axis-aligned bounding box (now empty) — it does not select.

**Acceptance Scenarios**:

1. **Given** a rotated shape, **When** the user clicks a point inside the rotated body, **Then** the shape is selected.
2. **Given** a rotated shape, **When** the user clicks a point that is inside the original axis-aligned bbox but outside the rotated shape, **Then** the shape is NOT selected.
3. **Given** multiple overlapping rotated shapes, **When** the user clicks the visible top shape, **Then** the shape with the highest `zIndex` at that point is selected.

---

### User Story 3 - Resize a Rotated Shape (Priority: P2)

A user selects a rotated shape and drags one of its resize handles. The resize should behave intuitively: the handle moves in the direction the user drags, the opposite side stays anchored, and the shape remains at the same rotation angle throughout.

**Why this priority**: Resize is a critical editing operation; supporting it correctly for rotated shapes completes the rotate feature end-to-end.

**Independent Test**: Rotate a rectangle 45°, drag its bottom-right handle — the shape grows/shrinks while staying at 45°, and the top-left corner remains stationary.

**Acceptance Scenarios**:

1. **Given** a rotated shape and a resize handle is dragged, **When** the drag is in progress, **Then** the shape is resized in the handle's local (rotated) coordinate frame while keeping the opposite corner/edge anchored.
2. **Given** a resize interaction on a rotated shape, **When** the drag ends, **Then** `patchElement` is called with updated `x`, `y`, `width`, `height` (and unchanged `angle`) and stored correctly.
3. **Given** a resize that would flip the shape (drag past the opposite edge), **When** the flip occurs, **Then** width/height remain positive, the logical handle flips to the opposite side, and the shape renders correctly without negative dimensions.
4. **Given** a rotated line or polygon with `props.points`, **When** the shape is resized, **Then** `props.points` are scaled and mirrored correctly to keep the visual geometry consistent with the new bbox.

---

### Edge Cases

- What happens when `angle` is exactly `0`? → Existing resize/hit-test behavior unchanged (backward-compatible).
- What happens when `angle` is a multiple of `2π`? → Treated as `0`; no visual difference.
- What happens when the rotate handle is dragged very fast? → Angle updates are clamped to `[-π, π]` range via normalization; no overflow.
- How does the system handle a shape with `width = 0` or `height = 0`? → Division-by-zero guard in resize; minimum dimension of 1px enforced.
- What happens if two shapes overlap at the same `zIndex`? → Click selects the one rendered last (highest array index); no change from P1A behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display a rotate handle for the selected shape, positioned outside the bounding box (e.g., above the top edge), when the select tool is active.
- **FR-002**: Dragging the rotate handle MUST rotate the shape in real time around the center of its bounding box, updating `draftElement.angle` during drag and committing via `patchElement` on release.
- **FR-003**: The rotation angle MUST be stored in radians in `element.angle`; the value MUST be normalized to `[-π, π]`.
- **FR-004**: Hit-testing for a rotated shape MUST un-rotate the candidate point by `-angle` around the shape's center before performing the axis-aligned bbox (or polygon) test.
- **FR-005**: Resize handles MUST be positioned at the corners and mid-edges of the shape in its local (rotated) coordinate frame and rendered in world space.
- **FR-006**: Resize operations on a rotated shape MUST transform the drag delta into the shape's local coordinate frame (un-rotate by `-angle`) before computing the new `width`, `height`, `x`, and `y`.
- **FR-007**: When a resize would produce negative `width` or `height`, the bbox MUST be normalized (width/height > 0), and the logical resize handle MUST flip to the opposite side.
- **FR-008**: For elements with `props.points` (line, polygon, freehand), resize MUST scale and/or mirror the points array to match the new bbox.
- **FR-009**: All rotate and resize mutations MUST go through the `patchElement` pipeline (version increment, history capture, persist, broadcast readiness).
- **FR-010**: Adding rotation support MUST NOT require changes to the core canvas or mutation pipeline — only `ShapeUtil` implementations and the interaction/tool layer.

### Key Entities

- **Element**: `angle: number` (radians, normalized `[-π, π]`); `x`, `y` (world top-left of bbox); `width`, `height` (positive); `props.points` (for multi-point shapes).
- **ResizeSession**: `originalBounds: Rect`, `originalHandle: ResizeHandleId`, `anchor: Point` — unchanged from P1A but now used in rotated-coordinate math.
- **InteractionState**: `draftElement` holds the in-progress rotated/resized element preview; `resizeHandle` and `resizeSession` track active resize.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can rotate any supported shape type (rectangle, ellipse, line, text) using the rotate handle; the angle is visually accurate and persists across re-selections and page reloads.
- **SC-002**: Clicking inside the rendered (rotated) body of a shape selects it with 100% accuracy; clicking clearly outside (but inside the old axis-aligned bbox) does not select it.
- **SC-003**: Resizing a rotated shape via any of the 8 handles produces the correct new dimensions and position; the shape remains at the same angle after resize.
- **SC-004**: The rotate/resize interaction causes no regression in P1A behavior — shapes with `angle = 0` continue to behave identically to before.
- **SC-005**: All rotate and resize mutations are reflected in localStorage and are restored correctly on page reload.

## Assumptions

- Rotation is always around the center of the element's bounding box (`cx = x + width/2`, `cy = y + height/2`).
- Rotation snapping (e.g., to 15° increments) is out of scope for P1B-01.
- The rotate handle is shown only when exactly one shape is selected (multi-selection rotate is out of scope).
- Visual rotation is achieved via a CSS/SVG `transform: rotate(angle)` around the element center; the stored `x`, `y` remain the top-left of the un-rotated bbox.
- All existing P1A shape types (rectangle, ellipse, line, text) must support rotation. New types (diamond, triangle, polygon) from P1B-02 will inherit the same mechanism.
- The rotate handle snaps to the center-top of the shape's selection ring, offset outward by a fixed pixel distance from the bounding box.
