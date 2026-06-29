# Feature Specification: Z-order UI & Arrow Binding

**Feature Branch**: `feat/online-room`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "P2.5-02 Z-order UI — bring-to-front/send-to-back/forward/backward updates zIndex; synchronised between clients. P2.5-03 Arrow Binding — arrow endpoint dropped near shape saves startBinding/endBinding; moving shape causes arrow to follow."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Change Layer Order of an Element (Priority: P1)

A collaborator selects a shape on the canvas and wants to adjust its stacking order relative to other shapes. They trigger "Bring to Front", "Send to Back", "Forward", or "Backward" from the context menu or toolbar. The selected shape immediately moves to the requested position in the stacking order, and every collaborator in the same room sees the change in real time.

**Why this priority**: Core drawing utility; without layer control, shapes accidentally overlap and obscure each other during design work, which is the primary blocker for usability.

**Independent Test**: Open a room with two overlapping shapes; right-click the bottom shape and choose "Bring to Front". The shape must appear on top, and a second browser tab in the same room must show the same result without refresh.

**Acceptance Scenarios**:

1. **Given** two overlapping shapes A (below) and B (above), **When** the user selects A and triggers "Bring to Front", **Then** A is rendered above B for all clients.
2. **Given** three shapes with shape C at the top, **When** the user selects C and triggers "Send to Back", **Then** C is rendered below all others for all clients.
3. **Given** shape A directly below shape B, **When** the user selects A and triggers "Forward", **Then** A swaps to one step above B; other relative orderings are unchanged for all clients.
4. **Given** shape A directly above shape B, **When** the user selects A and triggers "Backward", **Then** A swaps to one step below B; other relative orderings are unchanged for all clients.
5. **Given** a shape already at the topmost position, **When** the user triggers "Bring to Front" or "Forward", **Then** the stacking order does not change and no error is shown.
6. **Given** a shape already at the bottommost position, **When** the user triggers "Send to Back" or "Backward", **Then** the stacking order does not change and no error is shown.
7. **Given** multiple shapes are selected, **When** the user triggers any z-order command, **Then** the command is either applied to the entire selection as a group or disabled with a visible indicator—no silent partial update.

---

### User Story 2 - Bind an Arrow Endpoint to a Shape (Priority: P1)

A user draws an arrow and, while positioning one of its endpoints, drags it close to an existing shape. When released within the snap threshold, the endpoint attaches to that shape. The attached endpoint is visually distinct (snap indicator) so the user knows the binding is active.

**Why this priority**: Arrow binding is fundamental to diagramming. Without it, arrows detach from shapes during moves, breaking semantic connections between diagram nodes.

**Independent Test**: Draw two rectangles; draw an arrow and drop its endpoint near one rectangle. Move the rectangle; confirm the arrow endpoint moves with it.

**Acceptance Scenarios**:

1. **Given** an arrow being drawn, **When** the user releases the endpoint within the snap distance of a shape, **Then** the endpoint snaps to the shape's nearest edge/centre point and the binding is saved.
2. **Given** an arrow endpoint snapped to a shape, **When** the user moves the bound shape, **Then** the corresponding arrow endpoint moves to maintain the geometric connection.
3. **Given** an arrow with one bound endpoint and one free endpoint, **When** the user moves the free endpoint, **Then** only the free endpoint moves; the bound endpoint stays attached to its shape.
4. **Given** an arrow endpoint is outside the snap threshold of all shapes, **When** the user releases it, **Then** the endpoint is placed freely with no binding recorded.
5. **Given** an arrow bound to a shape, **When** the bound shape is deleted, **Then** the arrow endpoint is released and placed at the position the shape occupied at time of deletion; the arrow is not deleted.
6. **Given** an arrow with a binding, **When** the arrow endpoint is dragged away from its bound shape beyond the snap threshold and released, **Then** the binding is removed and the endpoint is placed at the release position.

---

### User Story 3 - Real-time Sync of Arrow Binding (Priority: P2)

When one collaborator creates or removes a binding between an arrow and a shape, all other collaborators in the room see the updated binding without refreshing the page.

**Why this priority**: Without sync, the binding state diverges between clients, causing one user's diagram to show connected shapes while another sees free-floating arrows.

**Independent Test**: In two browser tabs sharing a room, bind an arrow to a shape in Tab A; move the shape in Tab A; confirm the arrow follows in Tab B without refresh.

**Acceptance Scenarios**:

1. **Given** two clients in the same room, **When** client A binds an arrow endpoint to a shape, **Then** client B's canvas reflects the binding immediately.
2. **Given** a bound arrow visible to two clients, **When** client A moves the bound shape, **Then** client B sees the arrow follow the shape in real time.
3. **Given** a bound arrow visible to two clients, **When** client A removes the binding by dragging the endpoint away, **Then** client B sees the endpoint become free.

---

### Edge Cases

- What happens when two users simultaneously change the z-order of the same element? Last-Write-Wins using element version/versionNonce applies; the element settles to one deterministic stacking position.
- What happens when a user drags an arrow endpoint to a position that is close to multiple shapes simultaneously? The closest shape (smallest distance between endpoint and shape centre/edge) takes priority; ties resolve to the shape with the higher z-order.
- What happens to arrow bindings when a bound shape is resized? The bound endpoint recalculates its world position using the shape's updated geometry so the visual connection is preserved.
- What happens when an element's z-order is changed while it is being moved by another user? The stacking position update is applied via Last-Write-Wins; no visual glitch beyond a brief reorder.
- What happens to z-order when a new element is created? New elements are placed at the top of the stack by default.

## Requirements *(mandatory)*

### Functional Requirements

**Z-order (P2.5-02)**

- **FR-001**: Users MUST be able to move a selected element to the top of the stacking order ("Bring to Front").
- **FR-002**: Users MUST be able to move a selected element to the bottom of the stacking order ("Send to Back").
- **FR-003**: Users MUST be able to move a selected element one position higher in the stacking order ("Forward").
- **FR-004**: Users MUST be able to move a selected element one position lower in the stacking order ("Backward").
- **FR-005**: Every z-order change MUST be broadcast to all clients in the same room so stacking order converges across collaborators.
- **FR-006**: Z-order commands applied to an element already at the boundary (top for Bring to Front / Forward, bottom for Send to Back / Backward) MUST be no-ops — no error, no change.
- **FR-007**: Z-order commands for multi-element selections MUST be either fully supported as group operations or visually disabled to prevent ambiguous partial updates.

**Arrow Binding (P2.5-03)**

- **FR-008**: When an arrow endpoint is released within a configurable snap threshold of a shape, the endpoint MUST snap to the nearest attachment point on that shape and a binding reference MUST be saved on the arrow element.
- **FR-009**: When a shape with bound arrow endpoints is moved, the bound endpoints MUST reposition automatically to maintain the visual connection.
- **FR-010**: When a shape with bound arrow endpoints is resized, the bound endpoints MUST reposition to reflect the new geometry.
- **FR-011**: When a shape with bound arrow endpoints is deleted, each affected arrow endpoint MUST be released to the shape's last position; the arrow itself MUST NOT be deleted.
- **FR-012**: When a bound arrow endpoint is dragged beyond the snap threshold and released on empty canvas, the binding MUST be removed.
- **FR-013**: Arrow binding state (start and end binding references) MUST be included in the element's sync payload so all clients see consistent binding information.

### Key Entities

- **Element**: A drawable canvas object (rectangle, ellipse, text, arrow, etc.) with a `zIndex` integer controlling paint order and optional `startBinding`/`endBinding` fields for arrows.
- **Binding**: A reference from an arrow endpoint to a target shape, recording the target's element ID and the attachment point (e.g., centre, edge midpoints). Not a separate entity — stored inline on the arrow element.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can change a shape's stacking position in under 2 seconds via UI action (context menu or toolbar).
- **SC-002**: Z-order changes appear on all collaborator screens within 500 ms of being applied (matches existing realtime sync latency budget).
- **SC-003**: An arrow endpoint snaps to a shape and the binding is saved in a single drag-and-release gesture — no additional confirmation step required.
- **SC-004**: When a bound shape is moved, the arrow endpoint repositions within the same render frame — no visible lag between shape position and arrow position.
- **SC-005**: Binding state is consistent across all clients in a room within 500 ms of any binding change (create, remove, or indirect update via shape move).
- **SC-006**: Z-order commands and arrow binding are included in undo history — a single Undo reverts each operation atomically.

## Assumptions

- Only one element can be selected for z-order changes at a time in this phase; multi-select z-order is disabled (FR-007 enforced by disabling the command in the toolbar/context menu when selection count > 1).
- The snap distance threshold for arrow binding is a fixed constant (not user-configurable in this phase); a default of approximately 20 canvas pixels is assumed.
- Arrow attachment points are the shape centre and the four edge midpoints (top, right, bottom, left); corner attachment is out of scope for this phase.
- All z-order operations are undoable via the existing Undo/Redo pipeline.
- Arrow binding operations (snap, release) are undoable via the existing Undo/Redo pipeline.
- The backend server relays element-update events containing updated `zIndex` and binding fields without modification, consistent with the existing sync architecture.
- Fractional z-index values are out of scope; integer z-index only (per constitution Tech Stack Constraints).
