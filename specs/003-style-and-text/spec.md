# Feature Specification: Basic Style Panel & Text Properties (P1A-04 + P1A-05)

**Feature Branch**: `feat/local-editor`

**Created**: 2026-06-23

**Status**: Draft

**Input**: User description: "P1A-04 Style cơ bản và P1A-05 Text cơ bản"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Edit Shape Style (Priority: P1)

A user selects a shape on the canvas and uses a properties panel to change its visual appearance (stroke color, fill color, stroke width, opacity). Changes are immediately visible on the canvas without requiring any save action.

**Why this priority**: This is the core of P1A-04 — shapes without editable styles are not useful for a tactical whiteboard. Fill/stroke control is the minimum for distinguishing shapes by meaning.

**Independent Test**: Select any shape (rectangle, ellipse, etc.), open the detail panel, change stroke color — the shape immediately reflects the new color.

**Acceptance Scenarios**:

1. **Given** a rectangle is selected, **When** the user picks a new stroke color in the detail panel, **Then** the rectangle's outline changes to that color immediately.
2. **Given** a shape is selected, **When** the user changes fill color, **Then** the shape interior updates immediately.
3. **Given** a shape is selected, **When** the user changes stroke width (e.g., from 2 to 6), **Then** the outline thickness updates immediately.
4. **Given** a shape is selected, **When** the user drags the opacity slider from 100% to 50%, **Then** the shape becomes semi-transparent immediately.
5. **Given** no shape is selected, **When** the user looks at the canvas, **Then** the detail panel is hidden or shows no editable controls.

---

### User Story 2 - Edit Text Properties (Priority: P2)

A user selects a text element and uses a properties panel to change font size, font family, and text alignment. Changes are immediately visible on the canvas.

**Why this priority**: P1A-05 text properties build on the style panel from P1A-04. Text must be configurable to be useful as labels in a tactical whiteboard.

**Independent Test**: Create a text element, select it, change font size to 24 — the text on canvas immediately becomes larger.

**Acceptance Scenarios**:

1. **Given** a text element is selected, **When** the user changes font size, **Then** the text renders at the new size immediately.
2. **Given** a text element is selected, **When** the user selects a different font family, **Then** the text renders in the new font immediately.
3. **Given** a text element is selected, **When** the user selects "center" alignment, **Then** the text aligns to center within its bounding box.
4. **Given** a text element is selected, **When** the user selects "right" alignment, **Then** the text aligns to the right within its bounding box.
5. **Given** a non-text shape (e.g., rectangle) is selected, **When** the user views the detail panel, **Then** text-specific controls (font size, font family, text align) are NOT visible.

---

### User Story 3 - Style Changes Persist (Priority: P3)

Style changes made via the detail panel persist across selections — when a user selects a different shape and comes back, the previously edited shape retains its style.

**Why this priority**: Changes going through `patchElement` means they are committed to the store and will persist (they are part of the element's committed state).

**Independent Test**: Change a shape's fill to red, click elsewhere to deselect, re-select the shape — it is still red.

**Acceptance Scenarios**:

1. **Given** a shape's fill color was changed to red, **When** the user deselects and re-selects it, **Then** the fill is still red.
2. **Given** a text's font size was changed to 24, **When** the user deselects and re-selects it, **Then** the panel shows 24 and the canvas shows the text at size 24.

---

### Edge Cases

- What happens when a shape with `opacity=0` is selected? The detail panel should still show the element and its controls (even though it appears invisible).
- What is the valid range for stroke width? Values must be ≥ 1 (zero or negative not allowed).
- What is the valid range for font size? Values must be ≥ 1.
- What if multiple shapes are selected? (Out of scope for P1A; detail panel only handles single selection.)
- What does "text align" mean for a text element with a single word? The alignment affects the anchor point of the text within the element's bounding box.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST display a detail panel when exactly one element is selected.
- **FR-002**: The detail panel MUST be hidden (or show no controls) when no element is selected.
- **FR-003**: The detail panel MUST provide a color picker for stroke color, applicable to all element types.
- **FR-004**: The detail panel MUST provide a color picker for fill color, applicable to all element types except `line` (line has no fill).
- **FR-005**: The detail panel MUST provide a numeric input for stroke width (integer or float ≥ 1), applicable to all element types.
- **FR-006**: The detail panel MUST provide a slider or input for opacity (0–100% mapped to 0.0–1.0), applicable to all element types.
- **FR-007**: Every style change MUST be committed immediately via `patchElement` — no separate "apply" button.
- **FR-008**: The re-render triggered by a style change MUST be visible without requiring user action beyond the input interaction.
- **FR-009**: When a `text` element is selected, the panel MUST additionally show a font size numeric input.
- **FR-010**: When a `text` element is selected, the panel MUST additionally show a font family selector (at minimum: sans-serif, serif, monospace).
- **FR-011**: When a `text` element is selected, the panel MUST additionally show text alignment buttons (left / center / right).
- **FR-012**: Text property changes (fontSize, fontFamily, textAlign) MUST be committed via `patchElement` immediately.
- **FR-013**: Style changes MUST NOT bypass the mutation pipeline (no direct store writes).
- **FR-014**: Newly created text elements MUST have visible default content (`"Text"`) until the later in-place text editor can collect user-entered content.
- **FR-015**: When a text element's `fontFamily` changes, the system MUST recompute the text's natural dimensions and set `width` and `height` to fit those dimensions, expanding for wider fonts and shrinking for narrower fonts.

### Key Entities

- **Element**: The drawable object whose `props` (strokeColor, fillColor, strokeWidth, opacity, fontSize, fontFamily, textAlign) are being edited.
- **ElementProps**: The subset of element data holding all visual/style attributes.
- **DetailPanel**: The UI component that reads the selected element's current props and dispatches `patchElement` on user input.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: After selecting a shape and changing a style property, the visual change appears on canvas within the same render frame (≤16ms at 60fps — imperceptible delay).
- **SC-002**: All four base style properties (stroke color, fill color, stroke width, opacity) are editable from the detail panel for every supported shape type.
- **SC-003**: All three text-specific properties (font size, font family, text alignment) are editable from the detail panel when a text element is selected.
- **SC-004**: Every style change flows through the single mutation pipeline — no bypasses that skip versioning, history, or broadcast hooks.
- **SC-005**: Text-specific controls do not appear when a non-text shape is selected.

## Assumptions

- Multi-selection style editing is out of scope for P1A; the detail panel handles exactly one selected element at a time.
- `strokeStyle` (solid/dashed/dotted) control is not required for P1A-04 (it is part of P1A and may be added if straightforward, but is not a blocker).
- Full auto-sizing of text content edits is deferred to P1B-03; however, detail-panel font changes must keep the bbox fitted to the measured or estimated text dimensions.
- In-place editing text content is out of scope for P1A-05 (deferred to P1B-03); the creation tool uses visible default content so the new element can be seen and selected.
- Font families offered in the selector are a fixed short list: `sans-serif`, `serif`, `monospace` (expandable later).
- The detail panel is a floating/side panel rendered inside the Whiteboard component; its exact layout is determined in the plan.
- The text tool already exists in the toolbar and uses `create-shape-tool.ts`; P1A-05 only adds property-editing controls, not a new creation flow.
- "Style changes persist" (User Story 3) means in-session persistence via the committed Zustand store. Cross-reload persistence (localStorage) is implemented separately in P1A-09 and is not in scope here.
