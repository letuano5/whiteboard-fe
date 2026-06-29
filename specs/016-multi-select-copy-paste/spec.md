# Feature Specification: Multi-select + Duplicate/Copy-Paste

**Feature Branch**: `016-multi-select-copy-paste`

**Created**: 2026-06-27

**Status**: Draft

**Input**: User description: "### [P2-08] Multi-select + Duplicate/Copy-Paste — Marquee + shift-click; move/style/delete áp cả tập chọn. Ctrl/Cmd+D / C / V hoạt động với một và nhiều shape."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Marquee (rubber-band) selection (Priority: P1)

The user drags on an empty area of the canvas to draw a selection rectangle. All shapes whose bounding boxes intersect the rectangle become selected simultaneously.

**Why this priority**: Core multi-select entry point; without it the shift-click and bulk-action stories have no way to gather a set of elements.

**Independent Test**: Open the whiteboard with several shapes placed, drag across two or more shapes without starting on a shape, and verify all shapes within/intersecting the rectangle are highlighted together.

**Acceptance Scenarios**:

1. **Given** the canvas has 3 shapes and nothing is selected, **When** the user drags from empty space to draw a rectangle that overlaps 2 shapes, **Then** those 2 shapes are selected (shown with selection handles / highlight) and the third is not.
2. **Given** a drag is in progress, **When** the user releases the mouse, **Then** the rubber-band rectangle disappears and the matched shapes remain selected.
3. **Given** a marquee drag is started, **When** the user releases without covering any shape, **Then** the selection is cleared (nothing selected).

---

### User Story 2 - Shift-click to add/remove from selection (Priority: P1)

The user can hold Shift and click individual shapes to add them to or remove them from the current selection.

**Why this priority**: Complements marquee; allows fine-grained selection building without re-dragging.

**Independent Test**: Select one shape, then Shift-click a second shape and verify both are selected; Shift-click the first shape again and verify only the second remains selected.

**Acceptance Scenarios**:

1. **Given** shape A is selected, **When** the user Shift-clicks shape B, **Then** both A and B are selected.
2. **Given** shapes A and B are selected, **When** the user Shift-clicks shape A, **Then** only shape B remains selected.
3. **Given** nothing is selected, **When** the user Shift-clicks shape A, **Then** shape A becomes selected.
4. **Given** a multi-selection exists, **When** the user clicks empty canvas without Shift, **Then** the selection is cleared.

---

### User Story 3 - Bulk move/style/delete on multi-selection (Priority: P2)

When multiple shapes are selected, dragging any selected shape moves all of them together; style changes (color, stroke) apply to all; Delete/Backspace removes all.

**Why this priority**: Without bulk operations, multi-selection has no practical value.

**Independent Test**: Select 3 shapes, drag one — all three must translate by the same delta. Then change fill color — all three must update. Then press Delete — all three must be removed.

**Acceptance Scenarios**:

1. **Given** shapes A and B are selected, **When** the user drags shape A by (dx, dy), **Then** both A and B translate by exactly (dx, dy).
2. **Given** shapes A and B are selected, **When** the user changes the fill color via the style panel, **Then** both A and B adopt the new fill color.
3. **Given** shapes A and B are selected, **When** the user presses Delete or Backspace, **Then** both A and B are removed from the canvas.
4. **Given** shapes A, B, C are selected and all are locked/read-only is not a concern (no lock feature yet), **When** any bulk operation is applied, **Then** all selected shapes are affected uniformly.

---

### User Story 4 - Duplicate (Ctrl/Cmd+D) (Priority: P2)

Pressing Ctrl+D (or Cmd+D on macOS) duplicates all currently selected shapes, placing the copies at a fixed offset from the originals, and selects the copies.

**Why this priority**: Frequent tactical-board action (clone a unit marker); reduces repetition.

**Independent Test**: Select one or more shapes, press Ctrl+D, verify new copies appear offset from originals and are now selected while originals are deselected.

**Acceptance Scenarios**:

1. **Given** shape A is selected, **When** the user presses Ctrl/Cmd+D, **Then** a new copy of A appears offset by (+10 px, +10 px), the copy is selected, and shape A is deselected.
2. **Given** shapes A and B are selected, **When** the user presses Ctrl/Cmd+D, **Then** copies of both A and B appear offset by (+10 px, +10 px), both copies are selected, and originals are deselected.
3. **Given** nothing is selected, **When** the user presses Ctrl/Cmd+D, **Then** nothing happens (no-op).

---

### User Story 5 - Copy/Paste (Ctrl/Cmd+C / Ctrl/Cmd+V) (Priority: P3)

Users can copy selected shapes to an in-memory clipboard and paste them to create new copies, supporting multiple paste operations.

**Why this priority**: Copy-paste is less urgent than duplicate (which is quicker for single-step duplication) but necessary for workflows that require pasting at a different location or after navigating away.

**Independent Test**: Select shapes, press Ctrl+C, then Ctrl+V, verify copies appear offset from clipboard originals, then press Ctrl+V again and verify a second set of copies appears.

**Acceptance Scenarios**:

1. **Given** shapes A and B are selected, **When** the user presses Ctrl/Cmd+C, **Then** A and B are stored in the in-memory clipboard (no OS clipboard required) and selection does not change.
2. **Given** shapes A and B are in the clipboard, **When** the user presses Ctrl/Cmd+V, **Then** copies of A and B appear offset by (+10 px, +10 px) from the clipboard originals, are selected, and the clipboard remains populated for future pastes.
3. **Given** shapes A and B are in the clipboard, **When** the user presses Ctrl/Cmd+V a second time, **Then** a second pair of copies appears, each further offset by (+10 px, +10 px) from the previous paste's positions.
4. **Given** clipboard is empty, **When** the user presses Ctrl/Cmd+V, **Then** nothing happens (no-op).

---

### Edge Cases

- What happens when the user starts a marquee drag on top of an existing shape? → Regular drag (move) behavior, not marquee.
- What if a selected shape is moved to overlap another selected shape? → Both still move; no collision detection.
- What if the canvas is zoomed/panned when pasting? → Paste offset is applied in canvas coordinates, regardless of zoom.
- How does multi-select interact with undo/redo? → Each bulk operation is a single undo step.
- What if the user presses Ctrl+C with nothing selected? → No-op; clipboard unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow users to select multiple shapes simultaneously by dragging a rubber-band rectangle over empty canvas area.
- **FR-002**: The system MUST allow users to add/remove individual shapes from an existing selection by Shift-clicking them.
- **FR-003**: The system MUST visually distinguish a multi-selection (e.g., combined bounding box or per-shape handles).
- **FR-004**: The system MUST move all selected shapes together when the user drags any one of them.
- **FR-005**: The system MUST apply style changes (fill color, stroke color, stroke width) to all selected shapes when the user modifies a style property.
- **FR-006**: The system MUST delete all selected shapes when the user presses Delete or Backspace.
- **FR-007**: The system MUST duplicate all selected shapes (offset +10 px, +10 px) when the user presses Ctrl/Cmd+D, then select the copies and deselect the originals.
- **FR-008**: The system MUST copy all selected shapes to an in-memory clipboard when the user presses Ctrl/Cmd+C.
- **FR-009**: The system MUST paste clipboard contents (offset +10 px, +10 px) when the user presses Ctrl/Cmd+V, leaving the clipboard intact for repeated pastes.
- **FR-010**: The system MUST ensure each multi-shape operation (move, style, delete, duplicate, paste) is treated as a single undo step.

### Key Entities

- **Selection**: The set of currently selected element IDs (`selectedIds: string[]`). Extends the existing single-selection state.
- **Clipboard**: In-memory array of element snapshots (deep copies) stored when Ctrl+C is pressed. Persists until overwritten; not synced to OS clipboard.
- **BoundingBox**: Computed union of all selected elements' bounding boxes, used for rendering the multi-select handles.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can select any combination of existing shapes within 2 interactions (one drag or one click + shift-clicks).
- **SC-002**: Bulk move, style, and delete operations complete without visible lag for up to 50 simultaneously selected shapes.
- **SC-003**: Duplicate (Ctrl/Cmd+D) and Paste (Ctrl/Cmd+V) produce pixel-accurate copies offset by exactly (+10 px, +10 px) from the source positions.
- **SC-004**: Every multi-shape operation is fully undoable in a single Ctrl/Cmd+Z step.
- **SC-005**: 100% of keyboard shortcuts (Ctrl/Cmd+D, C, V) work on both macOS and Windows/Linux keyboard layouts.

## Assumptions

- OS clipboard integration is out of scope; an in-memory clipboard is sufficient.
- The existing undo/redo stack (P1B feature) is already implemented and supports batching multiple element mutations into one history entry.
- Selection state currently holds a single element ID (`selectedId`); this feature migrates it to an array (`selectedIds`).
- Touch/stylus multi-touch gestures for selection are out of scope for this feature.
- Shape locking is not yet implemented; all shapes are eligible for selection and bulk operations.
- Paste offset is always (+10, +10) in canvas coordinates; no smart placement to avoid overlaps.
- The realtime sync layer broadcasts element mutations; multi-shape operations broadcast each affected element mutation individually (same as single-element mutations today).
