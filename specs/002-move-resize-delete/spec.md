# Feature Specification: Move / Resize / Delete Shape

**Feature Branch**: `feat/local-editor`

**Created**: 2026-06-23

**Status**: Draft

**Input**: P1A-03 from `docs/SPECS.md` — Move cập nhật `x,y`; resize cập nhật `width,height`; Delete (Del/Backspace) → soft delete.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Move Shape (Priority: P1)

A user has selected a shape on the canvas. They click and drag the shape body (not on a handle) to reposition it. The shape follows the pointer and lands at the new location when the pointer is released.

**Why this priority**: Repositioning is the most frequent editing action after creation; it is the foundation of a usable whiteboard.

**Independent Test**: Select any shape, drag it to a new position, release — the shape must appear at the dropped location with the canvas immediately reflecting the change.

**Acceptance Scenarios**:

1. **Given** a shape is selected and the select tool is active, **When** the user presses the pointer on the shape body and drags by (dx, dy) world units, **Then** the shape visually follows the pointer (live preview); the committed `x` and `y` in the element store are updated on pointer release (covered by scenario 2).
2. **Given** a shape is being dragged, **When** the pointer is released, **Then** the element in the store has updated `x`, `y`, incremented `version`, and new `versionNonce`.
3. **Given** no shape is selected, **When** the user presses the pointer on the canvas, **Then** no drag-move interaction begins (click-to-select behavior from P1A-02 applies instead).
4. **Given** a line stores its rendered geometry as absolute points, **When** the line is moved by (dx, dy), **Then** every point is translated by the same delta so the rendered line, hit area, and selection bounds remain aligned.

---

### User Story 2 - Resize Shape via Handles (Priority: P1)

A user has selected a shape and sees 8 resize handles around its bounding box. They drag a handle to change the shape's width and/or height. For corner and edge handles on the left/top side, the anchor point shifts accordingly.

**Why this priority**: Resizing is the second most fundamental editing action; without it, users are stuck with shapes at their creation size.

**Independent Test**: Select a shape, drag its `se` corner handle normally, then past the fixed opposite corner on the horizontal axis, vertical axis, and both axes. The shape must continue resizing with positive dimensions and the active logical corner must flip accordingly.

**Acceptance Scenarios**:

1. **Given** a shape is selected, **When** the user drags the `se` handle by (dx, dy), **Then** `width` changes by `+dx`, `height` changes by `+dy`, and `x`/`y` are unchanged.
2. **Given** a shape is selected, **When** the user drags the `nw` handle by (dx, dy), **Then** `x` changes by `+dx`, `y` changes by `+dy`, `width` changes by `−dx`, `height` changes by `−dy`.
3. **Given** a shape is selected, **When** the user drags the `n` handle by (0, dy), **Then** `y` changes by `+dy` and `height` changes by `−dy`; `x` and `width` are unchanged.
4. **Given** the pointer reaches the fixed anchor exactly or is within 1 world unit of it, **Then** the affected dimension uses a minimum size of 1 around the anchor.
5. **Given** a shape is being resized, **When** the pointer is released, **Then** the element in the store reflects the final dimensions with `version` incremented and new `versionNonce`.
6. **Given** a line stores its rendered geometry as absolute points, **When** its selection bounds are resized, **Then** every point is transformed into the new bounds so the rendered line and selection handles remain aligned.
7. **Given** a corner handle is being dragged, **When** the pointer crosses the fixed anchor horizontally, vertically, or on both axes, **Then** resizing continues on the opposite side, the logical active handle flips on the crossed axes, and the stored bounding box remains normalized with positive dimensions.
8. **Given** an edge handle is being dragged, **When** the pointer crosses its fixed opposite edge, **Then** the logical edge handle flips to the opposite edge while the unaffected axis remains unchanged.
9. **Given** a point-based shape is resized across an anchor, **Then** its point geometry is mirrored on each crossed axis rather than merely fitted into the normalized bounding box.
10. **Given** a resize is in progress, **Then** the selection border and all handles are rendered from the live draft bounds, including after a flip.

---

### User Story 3 - Delete Shape via Keyboard (Priority: P1)

A user has selected a shape. They press `Delete` or `Backspace`. The shape disappears from the canvas immediately and the selection is cleared.

**Why this priority**: Deletion is a core editing primitive; a whiteboard without delete is unusable.

**Independent Test**: Select a shape, press `Delete` — the shape must vanish from the canvas and `selectedIds` must be empty.

**Acceptance Scenarios**:

1. **Given** one shape is selected, **When** the user presses `Delete` or `Backspace`, **Then** the shape's `isDeleted` becomes `true` in the store.
2. **Given** a shape has been deleted, **Then** it is no longer rendered on the canvas.
3. **Given** a shape has been deleted, **Then** `selectedIds` in the interaction store is cleared to `[]`.
4. **Given** no shape is selected, **When** the user presses `Delete` or `Backspace`, **Then** nothing happens (no error, no state change).

---

### Edge Cases

- What happens when the pointer reaches the fixed anchor? → Keep a 1 world unit minimum on the side implied by the original handle.
- What happens when the pointer crosses the fixed anchor? → Continue resizing on the opposite side; flip the logical handle and keep normalized positive dimensions.
- What happens when the user drags a shape entirely off-screen? → Allowed (infinite canvas); shape persists at world coordinates.
- What happens when `Delete` is pressed while a drag-move is in progress? → Not a supported interaction for P1A; undefined behavior is acceptable.
- What happens when multiple shapes are selected and `Delete` is pressed? → Multi-select is P2; for P1A-03 only a single selection exists.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the select tool is active and a selected shape's body is dragged, the shape MUST visually follow the pointer in real time (live preview via transient state); the committed `x` and `y` in the element store MUST be updated when the pointer is released.
- **FR-002**: All move mutations MUST go through `patchElement` in the mutation pipeline; direct store writes are forbidden.
- **FR-003**: Each of the 8 resize handles (`nw`, `ne`, `sw`, `se`, `n`, `s`, `e`, `w`) MUST be interactive and trigger resize on drag.
- **FR-004**: For handles on the left edge (`nw`, `sw`, `w`), `x` MUST shift by the horizontal drag delta and `width` MUST adjust inversely.
- **FR-005**: For handles on the top edge (`nw`, `ne`, `n`), `y` MUST shift by the vertical drag delta and `height` MUST adjust inversely.
- **FR-006**: Committed and draft bounds MUST remain normalized with `width` and `height` at least 1 world unit; crossing an anchor MUST produce resize-with-flip rather than stopping at the minimum.
- **FR-007**: All resize mutations MUST go through `patchElement` in the mutation pipeline.
- **FR-008**: Pressing `Delete` or `Backspace` when a shape is selected MUST call `deleteElements` with that shape's ID (soft delete: `isDeleted = true`).
- **FR-009**: After deletion, `selectedIds` in the interaction store MUST be cleared.
- **FR-010**: Pressing `Delete`/`Backspace` when no shape is selected MUST be a no-op.
- **FR-011**: During a drag (move or resize), the pointer MUST be captured so the interaction continues even if the pointer leaves the SVG element.
- **FR-012**: A drag-move interaction MUST be distinguished from a resize-handle drag; clicking a handle starts resize, clicking the shape body starts move.
- **FR-013**: For point-based shapes such as lines, move and resize MUST update both the bounding box and the absolute point geometry in one committed mutation.
- **FR-014**: Resize start MUST capture the original bounds, original handle, and fixed opposite anchor in transient interaction state.
- **FR-015**: During resize, the logical active handle MUST flip horizontally and/or vertically when the pointer crosses the fixed anchor.
- **FR-016**: Edge-handle resize MUST preserve the unaffected axis while supporting flip on the affected axis.
- **FR-017**: Point geometry MUST be mirrored on crossed axes so point-based shapes preserve the fixed anchor and follow the dragged pointer.
- **FR-018**: The selection overlay MUST use live draft bounds during resize so handles stay attached to the currently rendered corners and edges.

### Key Entities

- **Element** (`x`, `y`, `width`, `height`, `version`, `versionNonce`, `isDeleted`): The committed shape data that move/resize/delete mutates.
- **InteractionState** (`selectedIds`, `draggingId`, `dragStart`, `resizeHandle`, `resizeSession`): Transient state tracking the in-progress drag operation and its original bounds/anchor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A shape can be repositioned from any location to any other location with a single drag gesture, with the shape visually following the pointer without visible lag (≤16ms / one render frame at 60fps).
- **SC-002**: A shape can be resized from any of its 8 handles; the resulting dimensions match the pointer endpoint within ±1 world unit.
- **SC-003**: No resize operation can store a dimension smaller than 1 world unit or a negative dimension; crossing an anchor continues smoothly as a flip.
- **SC-004**: A selected shape can be removed from the canvas with a single `Delete` or `Backspace` keypress; the shape disappears within one render frame.
- **SC-005**: All mutations produced by move, resize, and delete have a correctly incremented `version` and fresh `versionNonce` (verified by store state after each operation).
- **SC-006**: After moving or resizing a line, its rendered stroke, hit-test geometry, and selection bounds remain spatially aligned.
- **SC-007**: Each corner handle can cross the horizontal axis, vertical axis, or both axes of its fixed anchor and resolve to the correct opposite logical handle.

## Assumptions

- Angle is always 0 for P1A shapes; no un-rotation of pointer coordinates is needed for hit-test or resize.
- Only a single shape can be selected at a time in P1A (multi-select is P2-08).
- Live visual feedback during drag is required (shape follows pointer via draftElement preview); the committed store update happens on pointer release — this is intentional to avoid flooding the mutation/history pipeline with per-frame patches.
- The drag threshold to begin a move is zero pixels (any pointer movement after pointerdown on shape body triggers move).
- The `interactionStore` fields `draggingId`, `dragStart`, and `resizeHandle` are available or can be added; they are transient and never persisted.
- Pointer capture (`setPointerCapture`) is available and should be used during drag, consistent with the existing `create-shape-tool.ts` pattern.
- Line `props.points` are absolute world coordinates and must be transformed whenever the line bounding box changes.
- Resize flip is interaction geometry only; it does not persist negative dimensions or a permanent CSS/SVG `scale(-1)` transform.
