# Feature Specification: Room Join & Share Link

**Feature Branch**: `feat/online-room`

**Created**: 2026-06-27

**Status**: Draft

**Input**: User description: "[P2-01] Room + join + share link — Client gửi join-room theo roomId khi mount; UI tạo phòng mới / sao chép link; routing mở đúng phòng từ URL; Server xử lý join-room, quản lý danh sách phòng in-memory, broadcast trong cùng phòng."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Create a New Room (Priority: P1)

A user visits the application without a room URL. They click "Create new room", the system generates a unique room identifier, navigates to a URL containing that identifier, and the user lands on a blank collaborative canvas for that room.

**Why this priority**: This is the entry point for all real-time collaboration; without room creation there is no feature.

**Independent Test**: Can be fully tested by visiting the root URL, clicking "Create room", and verifying the URL changes to include a room ID and the canvas loads.

**Acceptance Scenarios**:

1. **Given** the user opens the app at the root URL with no room in the URL, **When** they click "Create new room", **Then** the URL updates to include a unique room identifier and the whiteboard canvas is displayed.
2. **Given** the user has created a room, **When** they reload the page at that room URL, **Then** the same canvas loads (room is re-joined by URL).
3. **Given** a room exists, **When** a second user opens the same room URL, **Then** both users are in the same room.

---

### User Story 2 — Join a Room via URL (Priority: P1)

A user opens a URL that contains a room identifier (e.g. `/?room=abc123`). The application parses the room ID from the URL, connects to the server, and joins that specific room so changes are scoped to participants in that room only.

**Why this priority**: Enables the core collaboration flow — without URL-based joining, inviting others is impossible.

**Independent Test**: Open a URL with a known `?room=<id>` parameter and verify the canvas loads for that room.

**Acceptance Scenarios**:

1. **Given** a URL with `?room=<id>`, **When** the application mounts, **Then** the client emits `join-room` with that `roomId` to the server.
2. **Given** the client has joined a room, **When** another client in the same room makes a change, **Then** the change is received by this client.
3. **Given** the client has joined a room, **When** a client in a different room makes a change, **Then** this client does NOT receive that change.

---

### User Story 3 — Copy Share Link (Priority: P2)

A user already inside a room wants to invite others. They click "Copy link" (or similar), and the current page URL is copied to the clipboard so they can share it.

**Why this priority**: Collaboration requires sharing; copy-link is the lowest-friction way to invite.

**Independent Test**: Inside a room, click the share/copy button and verify the clipboard contains the current room URL.

**Acceptance Scenarios**:

1. **Given** the user is inside a room, **When** they click the share link button, **Then** the full current URL is copied to the clipboard.
2. **Given** the copy action succeeded, **Then** brief visual feedback confirms the copy (e.g. button label changes or a toast appears).

---

### User Story 4 — Home Screen (No Room) (Priority: P2)

A user visits the app without a room ID in the URL. They see a landing/home view with a prominent "Create new room" action rather than an empty canvas.

**Why this priority**: Prevents a confusing blank-canvas experience when no room is specified.

**Independent Test**: Visit the root URL and verify the home/landing view is displayed instead of the canvas.

**Acceptance Scenarios**:

1. **Given** the user visits the root URL with no `?room=` parameter, **When** the app loads, **Then** a home/landing screen is shown — not an empty canvas.
2. **Given** the home screen is visible, **When** the user clicks "Create new room", **Then** they are navigated to a new room URL and the canvas is displayed.

---

### Edge Cases

- What happens when the URL contains an unrecognized or malformed room ID? → The client still attempts to join; the server creates the room on first join (rooms are in-memory, no pre-registration required).
- How does the system handle a user navigating away and back? → The client re-emits `join-room` on mount; the server re-admits them to the room.
- What if the user's browser blocks clipboard access? → The copy action degrades gracefully (e.g. shows the link in a text field for manual copy).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST parse a room identifier from the URL query parameter `?room=<id>` when the page loads.
- **FR-002**: When no room ID is present in the URL, the application MUST display a home/landing screen with a "Create new room" action.
- **FR-003**: Clicking "Create new room" MUST generate a unique room identifier (UUID v4) and navigate to `?room=<id>`.
- **FR-004**: When a room ID is present in the URL, the client MUST emit a `join-room` Socket.IO event carrying the `roomId` to the server upon mounting.
- **FR-005**: The server MUST handle `join-room` events and associate the connecting socket with the specified room.
- **FR-006**: The server MUST broadcast element-update events only to sockets in the same room (not to the entire server).
- **FR-007**: The server MUST manage room membership in-memory (no database required at this phase).
- **FR-008**: The UI MUST provide a "Copy share link" button visible when inside a room that copies the current URL to the clipboard.
- **FR-009**: The "Copy share link" action MUST provide brief visual confirmation feedback persisting for approximately 2 seconds.
- **FR-010**: The Socket.IO connection MUST be established only when a room ID is known; it MUST NOT connect from the home/landing screen.

### Key Entities

- **Room**: An in-memory namespace on the server identified by a `roomId` string. It tracks the set of connected socket IDs. Rooms require no pre-registration — they are created on first `join-room`.
- **RoomId**: A URL-safe string (UUID v4) that uniquely identifies a room and is the single routing token. Appears as the `?room=` query parameter.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from the home screen to a live whiteboard room in under 3 interactions (click "Create room" → land on canvas).
- **SC-002**: Two users opening the same room URL both receive each other's element changes in real time (verified manually or via an integration test).
- **SC-003**: A user in Room A does NOT receive element changes broadcast in Room B (isolation verified).
- **SC-004**: The share link button copies the correct URL in one click with visible confirmation.
- **SC-005**: The home screen appears when no room parameter is in the URL; the canvas appears when a valid room parameter is present.

## Assumptions

- Room IDs are UUID v4 strings; no human-readable names required at this phase.
- The server does not persist rooms; in-memory state is sufficient for Phase 2.
- URL routing uses the query-string pattern `?room=<id>` (no path-based routing or a third-party router library required — can be implemented with `URLSearchParams` and `window.history`).
- Rooms on the server are auto-created on first `join-room`. No explicit cleanup is required at this phase — empty rooms may accumulate in memory, which is acceptable for Phase 2 scale.
- Authentication and access control are out of scope (Phase 3B).
- The existing `applyRemoteElements` function (LWW) is reused as-is for receiving remote element updates over Socket.IO.
- The existing BroadcastChannel sync continues to operate in parallel within the same tab session (no conflict with Socket.IO layer).
