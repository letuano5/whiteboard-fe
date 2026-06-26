# Feature Specification: Select Shape (angle = 0)

**Feature Branch**: `feat/local-editor`

**Created**: 2026-06-23

**Status**: Draft

**Input**: User description: "[P1A-02] Select (angle = 0) — Click trúng shape để chọn; hiện bounding box + handle."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Click to Select a Shape (Priority: P1)

A user working on the whiteboard clicks on a shape (rectangle, ellipse, line, or text) and the shape becomes selected — indicated by a visible bounding box drawn around it with resize handles at corners and edges.

**Why this priority**: Selecting is the prerequisite for every subsequent editing action (move, resize, delete, style change). Without selection, the editor cannot function as an interactive tool.

**Independent Test**: Place one or more shapes on the canvas, switch to the select tool, click on a shape. A bounding box with handles must appear around the clicked shape and the shape's ID must appear in `selectedIds`.

**Acceptance Scenarios**:

1. **Given** the canvas has at least one shape and the select tool is active, **When** the user clicks inside the bounding box of that shape, **Then** a bounding box and resize handles appear around the shape and `selectedIds` contains the shape's ID.
2. **Given** two overlapping shapes with different `zIndex` values, **When** the user clicks on the overlapping area, **Then** the shape with the higher `zIndex` is selected (z-order priority).
3. **Given** a shape is selected, **When** the user clicks on a different shape, **Then** the new shape becomes selected and the previous selection is cleared.

---

### User Story 2 — Deselect by Clicking Empty Space (Priority: P2)

A user clicks on an empty area of the canvas (not hitting any shape) and any current selection is cleared, with the bounding box disappearing.

**Why this priority**: Without the ability to deselect, the UI has no way to return to a neutral state. Required for a complete selection flow.

**Independent Test**: Select a shape, then click an area with no shapes. The bounding box must disappear and `selectedIds` must be empty.

**Acceptance Scenarios**:

1. **Given** a shape is currently selected, **When** the user clicks on an empty area of the canvas, **Then** `selectedIds` becomes empty and the bounding box overlay is removed.
2. **Given** no shape is selected, **When** the user clicks on an empty area, **Then** nothing changes and no errors occur.

---

### Edge Cases

- What happens when a shape has zero or near-zero size? Hit-test must not crash; treat as not-hit.
- What happens when the canvas has no shapes at all? Clicking empty space should result in an empty `selectedIds` with no errors.
- What if two shapes share the same `zIndex`? The topmost one in render order (last in sorted list) is selected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow users to select a shape by clicking on it with the select tool active.
- **FR-002**: When a shape is selected, a bounding box overlay with handles at 4 corners and 4 edge midpoints MUST be rendered around the selected shape.
- **FR-003**: Hit-test MUST prefer the shape with the highest `zIndex` when shapes overlap at the click position.
- **FR-004**: Clicking on empty canvas space (hitting no shape) MUST clear the current selection.
- **FR-005**: Selection state MUST be stored in transient `interactionStore.selectedIds` and MUST NOT be written to the elements store or persisted.
- **FR-006**: Hit-test calculations MUST assume `angle = 0` (no rotation) for this phase.
- **FR-007**: Choosing a tool from the toolbar MUST clear the current selection and any transient select interaction state.

### Key Entities

- **Element**: A drawable object with `id`, `x`, `y`, `width`, `height`, `zIndex`, `angle`, `isDeleted`. Hit-tested by its axis-aligned bounding box (for all shapes at angle=0).
- **Selection overlay**: A visual layer rendered on top of the SVG, showing the bounding box and 8 handles for the currently selected element.
- **InteractionStore.selectedIds**: The authoritative list of selected element IDs (transient, not persisted).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can click any visible shape and see its selection handles appear within one frame (~16ms at 60fps) — no perceptible lag.
- **SC-002**: When two shapes overlap, the topmost shape (highest `zIndex`) is selected 100% of the time regardless of render order or draw timing.
- **SC-003**: Clicking empty canvas reliably clears all selections in 100% of cases with no ghost highlights remaining.
- **SC-004**: Selection state never leaks into the element store or localStorage — confirmed by inspecting store state after selection interactions.
- **SC-005**: Switching tools from the toolbar removes the selection overlay immediately, before the next canvas interaction.

## Assumptions

- All elements have `angle = 0` for this phase; rotation-aware hit-testing is deferred to Phase 1B.
- Only single-element selection is required in P1A-02; multi-select (marquee, shift-click) is deferred to P2-08.
- The "handles" rendered in the bounding box are visual only — they are not yet interactive (resize via handle is P1A-03).
- The select tool is already defined in `ToolId` as `'select'`; toolbar already renders a select button.
- Hit-test for all current shape types (rectangle, ellipse, line, text) uses axis-aligned bounding box containment for simplicity at angle=0.
