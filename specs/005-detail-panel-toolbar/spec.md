# Feature Specification: Detail Panel & Basic Toolbar (P1A-07 + P1A-08)

**Feature Branch**: `feat/local-editor`

**Created**: 2026-06-24

**Status**: Draft

**Input**: User description: "P1A-07 Detail Panel + P1A-08 Toolbar cơ bản"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Panel Visibility (Priority: P1)

A user selects a shape on the canvas. A detail panel appears, showing the shape's current properties and letting the user edit them. When the user clicks empty canvas space (deselecting), the panel disappears. When the user selects multiple shapes at once, the panel also disappears (multi-select editing is out of scope for P1A).

**Why this priority**: Without this, there is no way to know you're editing the right shape. The panel's visibility contract is the most fundamental behavior of P1A-07.

**Independent Test**: Click a shape — a panel with editable controls appears. Click empty space — the panel disappears.

**Acceptance Scenarios**:

1. **Given** no shape is selected, **When** the user views the canvas, **Then** the detail panel is not visible.
2. **Given** one shape is selected, **When** the user views the canvas, **Then** the detail panel is visible and shows that shape's properties.
3. **Given** multiple shapes are selected, **When** the user views the canvas, **Then** the detail panel is not visible.
4. **Given** a shape is selected, **When** the user clicks empty canvas space, **Then** the detail panel disappears.

---

### User Story 2 - Realtime Property Editing (Priority: P1)

A user selects a shape and edits a property (e.g., stroke color) in the detail panel. The shape on canvas updates immediately — no "save" button needed. Every change flows through the mutation pipeline (`patchElement`) so versioning, history, and future sync are automatic.

**Why this priority**: Realtime feedback is core to the detail panel's UX. Delayed or batched updates would make the panel feel broken.

**Independent Test**: Select a shape, change its stroke color — the shape changes color immediately without any extra action.

**Acceptance Scenarios**:

1. **Given** a shape is selected, **When** the user changes a property in the detail panel, **Then** the shape on canvas reflects the change immediately (within the same render frame).
2. **Given** a shape is selected, **When** the user changes a property, **Then** the change goes through `patchElement` (not a direct store write).
3. **Given** a shape with properties, **When** the detail panel opens, **Then** all displayed values match the shape's current properties in the store.

---

### User Story 3 - Panel Does Not Disrupt Selection (Priority: P2)

A user interacts with the detail panel (clicking inputs, sliders, color pickers) without accidentally deselecting the current shape or triggering canvas events. Clicking inside the panel must be "contained" — it must not bubble pointer events to the canvas.

**Why this priority**: If clicking the panel deselects the shape, the panel disappears and the user cannot complete their edit. This is a key correctness property.

**Independent Test**: Select a shape, click inside the panel's stroke color input — the shape stays selected.

**Acceptance Scenarios**:

1. **Given** a shape is selected, **When** the user clicks any control inside the detail panel, **Then** the shape remains selected.
2. **Given** a shape is selected, **When** the user interacts with the detail panel, **Then** no canvas pointer events fire.

---

### User Story 4 - Toolbar Tool Selection (Priority: P1)

A user sees a floating toolbar at the bottom of the canvas. It shows six tools: Select, Hand (pan), Rectangle, Ellipse, Line, and Text. The currently active tool is visually highlighted. Clicking a tool activates it and clears any current interaction state (selection, draft element, drag state) so the new tool starts clean.

**Why this priority**: The toolbar is the primary entry point for all drawing actions. Without it, users have no way to choose what to create.

**Independent Test**: Load the whiteboard — the toolbar is visible at the bottom. Click "Rectangle" — it becomes highlighted, and the previous selection is cleared.

**Acceptance Scenarios**:

1. **Given** the whiteboard is loaded, **When** the user views the canvas, **Then** the toolbar is visible with exactly 6 tools: Select, Hand, Rectangle, Ellipse, Line, Text.
2. **Given** the toolbar is visible, **When** the user views it, **Then** the currently active tool is visually distinguished from inactive tools.
3. **Given** any tool is active, **When** the user clicks a different tool, **Then** that tool becomes the active tool.
4. **Given** a shape is selected and a drawing tool is active, **When** the user clicks another tool, **Then** the previous selection is cleared (selectedIds becomes empty).
5. **Given** a resize or drag operation is in progress, **When** the user clicks a toolbar tool, **Then** all transient interaction state (draggingId, dragStart, resizeHandle, resizeSession, draftElement) is cleared.

---

### Edge Cases

- What happens when the selected element is deleted? The detail panel must not crash — it should handle the case where `elements.find(...)` returns `undefined`.
- What happens when the element's `isDeleted = true` but is still in `selectedIds`? The panel must treat this as "nothing selected" and hide.
- What if a tool button is clicked while a drawing is in progress (mid-drag)? The tool switch clears all transient state including `draftElement`, effectively cancelling the in-progress draw.
- What if the panel receives a pointer event and the pointer event bubbles to the canvas — causing an unintended deselection? Pointer events from the panel must be stopped at the panel boundary.

## Requirements *(mandatory)*

### Functional Requirements

**P1A-07 — Detail Panel**

- **FR-001**: The system MUST show the detail panel when exactly one non-deleted element is selected.
- **FR-002**: The system MUST hide the detail panel when zero elements are selected.
- **FR-003**: The system MUST hide the detail panel when two or more elements are selected.
- **FR-004**: The detail panel MUST display the currently selected element's properties as its current values (reads from store, not local state).
- **FR-005**: Every property change made in the detail panel MUST be applied immediately via `patchElement` — no batching or deferred commit.
- **FR-006**: The detail panel MUST stop pointer events from bubbling to the canvas (to prevent unintended deselection).
- **FR-007**: The detail panel MUST NOT perform direct store writes — all mutations go through the mutation pipeline.

**P1A-08 — Toolbar**

- **FR-008**: The toolbar MUST display exactly 6 tool buttons: Select, Hand, Rectangle, Ellipse, Line, Text.
- **FR-009**: The toolbar MUST visually distinguish the currently active tool from inactive tools (e.g., highlighted background or color).
- **FR-010**: Clicking a toolbar button MUST set that tool as the active tool in the interaction store.
- **FR-011**: Clicking a toolbar button MUST clear all current interaction state: `selectedIds`, `draggingId`, `dragStart`, `draftElement`, `resizeHandle`, `resizeSession`.

### Key Entities

- **Element**: The drawable object whose `id`, `type`, `props`, and `isDeleted` flag determine whether the detail panel appears and what it shows.
- **InteractionState**: The store slice holding `tool`, `selectedIds`, and all transient state cleared on tool switch.
- **DetailPanel**: The floating UI component that reads one selected element's props and dispatches `patchElement` on user input.
- **Toolbar**: The floating UI component displaying tool buttons and driving `tool` in the interaction store.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The detail panel appears or disappears within the same render frame as the selection change — no observable lag.
- **SC-002**: A property change in the detail panel is reflected on canvas within the same render frame (≤16ms at 60fps — imperceptible delay).
- **SC-003**: The toolbar shows exactly 6 tools; a user can select any tool in a single click.
- **SC-004**: No interaction state (selection, drag, resize, draft) leaks across a tool switch — every tool starts clean.
- **SC-005**: All property mutations from the detail panel go through the single mutation pipeline (no bypasses).

## Assumptions

- Style/text property editing details (which controls appear, what ranges are valid) are covered in spec 003-style-and-text (P1A-04 + P1A-05). This spec covers the panel's visibility and update contract only.
- The detail panel only handles single-selection (exactly one element). Multi-selection editing is out of scope for P1A.
- The toolbar tools are a fixed list for P1A: {select, hand, rectangle, ellipse, line, text}. Additional tools (diamond, triangle, etc.) are P1B+.
- The "hand" tool enables canvas panning; this is already implemented via the camera store and handled in the Whiteboard pointer handler. P1A-08 only requires that "hand" appears in the toolbar and can be selected.
- Keyboard shortcuts for tool switching (e.g., V for select, H for hand) are not part of P1A-08.
- The visual design of the toolbar (position, size, colors) is an implementation detail; the requirement is only that the active tool is visually distinguishable.
- Pointer event containment for the detail panel (FR-006) is implemented using `onPointerDown` with `stopPropagation` on the panel's root element.
