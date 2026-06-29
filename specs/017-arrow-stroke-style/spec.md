# Feature Specification: Arrow + Stroke Style

**Feature Branch**: `017-arrow-stroke-style`

**Created**: 2026-06-27

**Status**: Draft

**Input**: User description: "### [P2-09] Arrow cơ bản + Stroke style — Vẽ arrow 2 điểm có đầu mũi tên (binding → P2.5). `strokeStyle` solid/dashed/dotted."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Draw a two-point arrow (Priority: P1)

The user selects the Arrow tool, clicks to set the start point, and clicks (or drags) to set the end point, creating an arrow line with an arrowhead at the end.

**Why this priority**: Core deliverable of P2-09; all other stories depend on an arrow existing.

**Independent Test**: Select Arrow tool, draw from point A to point B, release, verify a line with a solid arrowhead appears pointing from A toward B.

**Acceptance Scenarios**:

1. **Given** the Arrow tool is selected, **When** the user presses and drags on the canvas from point A to point B, **Then** an arrow shape is created with the tail at A and a filled arrowhead at B.
2. **Given** an arrow has been drawn, **When** the canvas is rendered, **Then** the arrowhead is visually distinct (e.g., a filled triangular tip) and points in the direction from tail to head.
3. **Given** an arrow is selected, **When** the user drags the head or tail handle, **Then** the arrow updates in real-time to the new endpoint.
4. **Given** an arrow exists, **When** the user selects it and presses Delete/Backspace, **Then** the arrow is removed from the canvas.

---

### User Story 2 - Stroke style: solid / dashed / dotted (Priority: P1)

The user can change the stroke style of any shape (arrow, rectangle, ellipse, line, etc.) between solid, dashed, and dotted patterns.

**Why this priority**: Stroke style is a universal property; it applies to arrows and all existing shapes, making tactical notation richer.

**Independent Test**: Select any shape, open the style panel, cycle through solid/dashed/dotted, and verify the shape's stroke visually matches the chosen pattern.

**Acceptance Scenarios**:

1. **Given** a shape is selected, **When** the user sets stroke style to "dashed", **Then** the shape's stroke renders as a dashed line.
2. **Given** a shape is selected, **When** the user sets stroke style to "dotted", **Then** the shape's stroke renders as a dotted line.
3. **Given** a shape is selected, **When** the user sets stroke style to "solid", **Then** the shape's stroke renders as a continuous solid line (default behavior).
4. **Given** a new shape is created, **When** it first appears, **Then** its default stroke style is "solid".
5. **Given** a shape's stroke style is set to "dashed", **When** the shape is saved to local storage and the page is refreshed, **Then** the stroke style is restored as "dashed".

---

### User Story 3 - Arrow participates in common shape operations (Priority: P2)

An arrow can be moved, selected, styled, and deleted the same way as other shapes; it also participates in multi-select (P2-08) and undo/redo.

**Why this priority**: Consistency with existing shapes is required for a usable tool; arrows that behave differently would confuse users.

**Independent Test**: Draw an arrow, select it, drag it to a new position, change its stroke color, and undo all changes — the canvas returns to the pre-arrow state.

**Acceptance Scenarios**:

1. **Given** an arrow exists, **When** the user clicks on it, **Then** the arrow becomes selected with visible handles at tail and head (no midpoint handle in this feature).
2. **Given** an arrow is selected, **When** the user drags the arrow body (not a handle), **Then** the entire arrow (tail + head) moves by the drag delta.
3. **Given** an arrow is selected, **When** the user changes stroke color or stroke width, **Then** the arrow updates accordingly.
4. **Given** an arrow exists alongside other shapes, **When** the user performs a marquee selection that covers the arrow, **Then** the arrow is included in the multi-selection.

---

### Edge Cases

- What if the user draws an arrow with zero length (start == end)? → The arrow shape is not created (minimum drag distance required, e.g., 2 px).
- What if stroke style is changed on a multi-selection that includes both arrows and rectangles? → All selected shapes adopt the new stroke style.
- What is the arrowhead style — open or filled? → Filled triangular arrowhead by default; open style is out of scope for this feature.
- Does the arrow support a head on both ends? → No, single-direction arrow only (tail → head); bidirectional arrows are out of scope.
- Arrow binding (snap to shape endpoints) is explicitly deferred to P2.5 and out of scope here.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an Arrow drawing tool that lets users define a two-point arrow (tail and head) by click-drag on the canvas.
- **FR-002**: The system MUST render the arrow with a clearly visible filled arrowhead at the head endpoint.
- **FR-003**: The system MUST allow the user to reposition either endpoint (tail or head) by dragging the corresponding handle after the arrow is placed.
- **FR-004**: The system MUST support a `strokeStyle` property on ALL shape types (arrow, rectangle, ellipse, line) with three values: `solid`, `dashed`, `dotted`.
- **FR-005**: The system MUST default new shapes to `strokeStyle: "solid"`.
- **FR-006**: The system MUST expose a stroke-style selector in the style/detail panel that applies to the currently selected shape(s).
- **FR-007**: The system MUST persist the `strokeStyle` property alongside other shape properties in local storage.
- **FR-008**: Arrows MUST support all common shape operations: select, move (body drag), style change, delete, multi-select, and undo/redo.
- **FR-009**: The system MUST NOT implement arrow-to-shape binding in this feature (deferred to P2.5).
- **FR-010**: Arrow creation with start == end (zero-length drag, < 2 px) MUST be discarded without creating a shape.

### Key Entities

- **Arrow**: A new element type with `type: "arrow"`, `x1`, `y1` (tail), `x2`, `y2` (head), `strokeColor`, `strokeWidth`, `strokeStyle`.
- **StrokeStyle**: An enum `"solid" | "dashed" | "dotted"` added to the shared `Element` type and applicable to all shape types.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can draw a correctly-rendered arrow in under 3 seconds from tool activation.
- **SC-002**: Stroke style (solid/dashed/dotted) is visually distinguishable without any tooltip or legend.
- **SC-003**: Stroke style changes apply instantaneously (no perceptible delay) to all selected shapes, including arrows.
- **SC-004**: The `strokeStyle` property survives a page refresh for 100% of shapes that had it set.
- **SC-005**: Arrows participate in all existing operations (move, delete, undo, multi-select) with identical behavior to rectangles and ellipses.

## Assumptions

- The SVG renderer already supports `stroke-dasharray` for dashed/dotted patterns; specific dash values are decided at implementation time.
- The Arrow element does not need a midpoint control handle in this feature (straight line only; curves are out of scope).
- The arrowhead is rendered as an SVG polygon/path computed from the tail→head direction; no external arrowhead library is needed.
- Arrow binding to other shapes (P2.5-03) is explicitly out of scope; the arrow's endpoints are free-floating.
- The existing `Element` shared type will be extended with `strokeStyle`; all existing shapes that lack this property default to `"solid"` at render time.
- The style panel already exists (P1 feature); only a new stroke-style control needs to be added.
- Realtime sync: the `strokeStyle` field is part of the element payload, so it is broadcast automatically without special handling.
