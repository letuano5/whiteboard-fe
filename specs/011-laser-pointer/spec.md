# Feature Specification: Laser Pointer (Local, Transient)

**Feature Branch**: `011-laser-pointer`

**Created**: 2026-06-26

**Status**: Draft

**Input**: User description: "P1B-04 Laser Pointer (local, transient) — Vệt laser nằm trong interaction.laserTrail, không vào elements; tự mờ/biến mất."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Draw Laser Trail While Moving Mouse (Priority: P1)

A user selects the laser tool from the toolbar, then moves the mouse over the canvas. As they move, a bright glowing trail follows their cursor, visualizing their pointer path. After a short delay, the trail automatically fades and disappears — leaving no permanent mark on the canvas.

**Why this priority**: This is the core behavior of the laser pointer. Without it, the feature does not exist.

**Independent Test**: Can be fully tested by selecting the laser tool, moving the mouse across the canvas, and observing a trail appear and then disappear automatically within a few seconds.

**Acceptance Scenarios**:

1. **Given** the laser tool is active, **When** the user moves the mouse over the canvas, **Then** a colored trail appears along the cursor path.
2. **Given** a laser trail is visible, **When** ~1.5 seconds have elapsed with no new movement, **Then** the trail fades out and disappears completely.
3. **Given** the laser tool is active, **When** the user stops moving and then starts again, **Then** a new trail starts from the current cursor position.

---

### User Story 2 - Laser Tool Accessible via Toolbar (Priority: P2)

A user can activate the laser pointer by clicking its button in the toolbar, just like any other tool.

**Why this priority**: Without toolbar access, users cannot activate the tool.

**Independent Test**: Can be tested independently by checking the toolbar contains a laser tool button that sets the active tool to 'laser'.

**Acceptance Scenarios**:

1. **Given** the toolbar is visible, **When** the user clicks the laser tool button, **Then** the laser tool becomes active (button highlighted) and the cursor changes to crosshair style.
2. **Given** the laser tool is active, **When** the user clicks any other tool, **Then** the laser trail clears immediately and the new tool activates.

---

### User Story 3 - Laser Trail Never Persists to Canvas (Priority: P1)

The laser trail is ephemeral — it is never saved to localStorage, never added to the elements store, and never visible after the tool is switched away or the page is reloaded.

**Why this priority**: This is a fundamental constraint from the architecture spec: laser trail is transient state only.

**Independent Test**: Can be tested by using the laser tool, then switching tools or reloading; no laser trail remains.

**Acceptance Scenarios**:

1. **Given** a laser trail was recently drawn, **When** the user switches to another tool, **Then** the trail is cleared immediately from the screen.
2. **Given** a laser trail was drawn, **When** the page is reloaded, **Then** no trail is visible (it was never persisted).
3. **Given** the laser tool is active and a trail exists, **When** the trail times out, **Then** the elements store contains no new entries.

---

### Edge Cases

- What happens when the user moves the mouse very fast? Trail should still follow, possibly with fewer intermediate points.
- What happens when the user leaves the canvas boundary while using the laser tool? Trail stops accumulating points at the boundary.
- What happens if the user switches tool mid-trail? The trail clears immediately.
- What happens when the user activates laser on a canvas with existing shapes? The shapes remain unaffected; trail renders on top.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The laser tool MUST be selectable from the toolbar.
- **FR-002**: When the laser tool is active and the user moves the mouse over the canvas, the system MUST accumulate pointer positions into `interaction.laserTrail`.
- **FR-003**: The laser trail MUST be rendered visually on the canvas as a colored polyline that follows the cursor path.
- **FR-004**: The laser trail MUST automatically fade and disappear within approximately 1.5 seconds after the last pointer movement (1 second delay, then 0.5 second fade).
- **FR-005**: The laser trail MUST reside exclusively in transient interaction state (`interaction.laserTrail`) and MUST NOT be added to the elements store.
- **FR-006**: The laser trail MUST NOT be persisted to localStorage or any sync channel.
- **FR-007**: Switching away from the laser tool MUST immediately clear the laser trail.
- **FR-008**: The cursor MUST display as crosshair while the laser tool is active.
- **FR-009**: The laser trail rendering MUST respect the current camera transform so the trail appears correctly at any zoom level and pan position.

### Key Entities

- **LaserTrail**: A sequence of world-coordinate points (`Point[]`) stored in `interaction.laserTrail`. Has no id, no version, no zIndex — it is purely transient.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The laser trail appears on screen within one animation frame (~16ms) of the user moving the mouse.
- **SC-002**: The laser trail fully disappears within 1.5 seconds of the last pointer movement, with no manual action required.
- **SC-003**: After using the laser tool and switching to select tool, zero new entries appear in the elements store.
- **SC-004**: After page reload following laser tool use, no laser trail is visible.
- **SC-005**: The laser trail renders correctly (aligned with cursor) at zoom levels from 0.1× to 8×.

## Assumptions

- The fade-out duration is 1.5 seconds (1s delay then 0.5s opacity transition); this is an implementation constant, not user-configurable in Phase 1B.
- The laser trail renders as a single continuous polyline/path; it does not need to split into segments with per-segment opacity in Phase 1B (full trail fades together or fades from tail).
- Trail points are accumulated only while the pointer is over the canvas SVG area; off-canvas movements are ignored.
- The laser tool does not interact with element selection: switching to laser does not deselect elements (though the selection overlay may still be visible in the background).
- No keyboard shortcut is required for the laser tool in Phase 1B (toolbar click is sufficient).
