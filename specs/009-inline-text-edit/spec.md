# Feature Specification: Inline Text Editing (Double-click + Auto-bbox)

**Feature Branch**: `009-inline-text-edit`

**Created**: 2026-06-25

**Status**: Draft

**Input**: User description: "[P1B-03] Double-click mở ô chỉnh tại chỗ (contenteditable trong layer transform). Blur/Esc commit vào `props.text` (qua `patchElement`); bbox co theo nội dung."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Edit Text of an Existing Text Element (Priority: P1)

A user has a text element on the canvas. They want to change its content. They double-click the element, type new text, then click elsewhere or press Escape to finish. The canvas immediately shows the updated text, and the element's bounding box adjusts to fit the new content.

**Why this priority**: Core editing capability — without it, text elements cannot be modified after creation. This is the minimum viable interaction for text on a whiteboard.

**Independent Test**: Create a text element, double-click it, type "Hello", then click outside. Verify the element displays "Hello" and its bounding box matches the rendered text size.

**Acceptance Scenarios**:

1. **Given** a text element exists on the canvas and the select tool is active, **When** the user double-clicks the element, **Then** an inline text editor opens over the element at the correct world position and zoom scale.
2. **Given** the inline text editor is open, **When** the user types new content and clicks outside (blur), **Then** the edited text is committed to `props.text` via `patchElement` and the editor closes.
3. **Given** the inline text editor is open, **When** the user presses the Escape key, **Then** the edited text is committed to `props.text` via `patchElement` and the editor closes.
4. **Given** the inline text editor is open with modified text, **When** the editor closes (blur or Escape), **Then** the element's `width` and `height` are updated to match the rendered text dimensions (auto-bbox).
5. **Given** the canvas is zoomed in or out, **When** the inline editor opens, **Then** the editor font size and position visually match the text element's appearance on the SVG canvas.

---

### User Story 2 — Text Element with No Content (Priority: P2)

A user opens the inline editor and clears all text, then commits. The element remains on the canvas with empty text and its bbox reflects the minimum content size.

**Why this priority**: Edge-case correctness — clearing text shouldn't crash or break the element.

**Independent Test**: Double-click a text element, select all and delete, then blur. Verify the element persists with `props.text === ""` and a reasonable minimum bbox.

**Acceptance Scenarios**:

1. **Given** the inline text editor is open, **When** the user deletes all content and blurs, **Then** the element remains with `props.text` set to an empty string (not deleted).
2. **Given** text is empty after commit, **Then** the element's `width` and `height` reflect the minimum measured size (at least 1px × line-height).

---

### User Story 3 — Double-click on Non-text Element (Priority: P3)

A user double-clicks on a rectangle, ellipse, or other non-text element. No inline editor opens.

**Why this priority**: Boundary correctness — inline editing is scoped to text elements only in this phase.

**Independent Test**: Double-click a rectangle. Verify no editor appears.

**Acceptance Scenarios**:

1. **Given** a rectangle (or other non-text element) is on the canvas, **When** the user double-clicks it, **Then** no inline text editor opens.

---

### Edge Cases

- What happens when the user double-clicks a text element that is currently being dragged or resized? → Editor does not open mid-drag/resize (double-click during these states is ignored).
- What if the text contains newlines? → Newlines are preserved in `props.text`; bbox reflects multi-line height.
- What if the canvas is panning when double-click occurs? → Editor does not open (pan gesture takes priority).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST open an inline `contenteditable` editor when the user double-clicks a `text`-type element while the select tool is active.
- **FR-002**: The inline editor MUST be positioned and scaled to match the element's world-coordinate bounding box under the current camera transform (zoom + pan).
- **FR-003**: System MUST commit the editor's content to `props.text` via `patchElement` when the editor loses focus (blur event).
- **FR-004**: System MUST commit the editor's content to `props.text` via `patchElement` when the user presses the Escape key while the editor is focused.
- **FR-005**: After committing, system MUST measure the rendered text dimensions and update the element's `width` and `height` via `patchElement` so the bounding box fits the content (auto-bbox).
- **FR-006**: System MUST NOT open an inline editor when the user double-clicks any non-text element type.
- **FR-007**: The inline editor MUST initialize with the current `props.text` content so the user can see and edit existing text.
- **FR-008**: While the inline editor is open, the element MUST be visually represented as editable (the SVG text rendering may be hidden or overlaid by the editor).
- **FR-009**: System MUST track which element is being edited in transient interaction state (`editingId`) — never in committed element state.
- **FR-010**: The inline editor MUST support multi-line text; the Enter key inserts a newline (natural `contenteditable` behavior).

### Key Entities

- **Text Element**: An `Element` with `type === 'text'`, carrying `props.text`, `props.fontSize`, `props.fontFamily`, `props.textAlign`, `x`, `y`, `width`, `height`, `angle`.
- **Editing Session**: Transient state (`editingId: string | null`) tracking which element is currently being inline-edited. Lives in `interaction.store.ts`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: User can edit the text content of any text element by double-clicking it within 1 interaction step (no menus, no extra clicks).
- **SC-002**: After committing, the element's bounding box exactly matches the rendered text dimensions (within ±2px tolerance for font rendering).
- **SC-003**: The inline editor appears within one animation frame of the double-click (visually immediate, no perceptible delay).
- **SC-004**: Both blur and Escape correctly commit changes on 100% of attempts (no lost edits).
- **SC-005**: Double-clicking a non-text element never opens the inline editor.

## Assumptions

- Inline text editing applies only to elements with `type === 'text'` in this phase. Shapes with text labels (rectangle, ellipse, etc.) are out of scope — they do not render text yet.
- The Enter key in the editor inserts a newline (natural `contenteditable` behavior); a separate "confirm" key is not added.
- Escape commits (does not discard) the current text, matching the spec's stated behavior.
- Creating a new text element does NOT automatically open the inline editor; the user must explicitly double-click.
- The auto-bbox measurement is done via the DOM dimensions of the `contenteditable` div at commit time.
- The `editingId` field is added to `InteractionState` in `interaction.store.ts` as transient state, never synced or persisted.
- Text element rotation (`angle !== 0`) is handled: the editor overlay is positioned using a CSS transform that includes both translation and rotation.
