# Feature Specification: Live Cursor & Online Users

**Feature Branch**: `feat/online-room`

**Created**: 2026-06-27

**Status**: Draft

> **[P2 Amendment — 2026-06-28]** Spec mở rộng thêm 3 hành vi:
>
> 1. **Session identity persistence** (`VDT_USER_IDENTITY` in localStorage): `sessionId`, `name`, `color` được đọc từ localStorage khi load; nếu không có thì random và ghi mới. Cùng browser = cùng identity dù bao nhiêu tab hay reload. File: `sync/presence.ts`.
>
> 2. **Viewport broadcast**: Mỗi `CURSOR_MOVE` emit kèm `viewport` (camera hiện tại). Khi camera thay đổi mà không di chuyển chuột (pan/zoom bàn phím/trackpad), camera subscription throttle 200ms emit `cursor: null` + `viewport`. Receiver xử lý `cursor: null` bằng cách giữ nguyên cursor position cũ của peer, chỉ update `viewport` trong `Presence`. File: `sync/socket-client.ts`.
>
> 3. **Camera persistence per room** (`VDT_CAMERA_{roomId}` in localStorage): Camera được lưu debounce 300ms sau mỗi thay đổi. Khi join room, camera được restore từ localStorage trước khi socket connect. Khi nhận viewport từ cùng sessionId (same user, tab khác), apply vào camera store và lưu localStorage ngay. File: `sync/camera-persistence.ts`.

**Input**: User description: "[P2-06] Live cursor + tên/màu: Throttle cursor position (~33ms) → gửi lên server ở toạ độ world; ephemeral (không vào elements). Nhận cursor của người khác → render nhãn tên + màu. [BE] Server relay cursor event trong phòng (không lưu). [P2-07] Danh sách user online: Nhận danh sách user online từ server; render UI; cập nhật khi join/leave. [BE] Server broadcast join/leave event cho phòng."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — See Others' Live Cursors (Priority: P1)

A collaborator joins a shared whiteboard room. When teammates move their mice around the canvas, the user sees colored cursor indicators labeled with each person's name moving in real time — letting them know where others are looking and working.

**Why this priority**: Without live cursors, collaborators are invisible to one another. Cursor presence is the most immediate signal of co-presence and the foundation of real-time collaboration awareness.

**Independent Test**: Open the same room URL in two browser tabs. Move the mouse in Tab A. Verify a colored cursor with a name label appears and tracks the movement in Tab B within ~100 ms.

**Acceptance Scenarios**:

1. **Given** two users are in the same room, **When** User A moves their cursor on the canvas, **Then** User B sees a labeled cursor indicator that tracks User A's position in real time.
2. **Given** User A's cursor is displayed on User B's screen, **When** User A moves to a different position, **Then** the cursor indicator on User B's screen updates to the new position.
3. **Given** two users are in the same room, **When** User A moves their cursor, **Then** User A does NOT see their own cursor represented as a remote cursor (only others' cursors are shown).
4. **Given** two users are in different rooms, **When** User A moves their cursor, **Then** User B (in the other room) does NOT receive the cursor event.
5. **Given** User A's cursor is visible on User B's screen, **When** User A leaves the room, **Then** User A's cursor indicator disappears from User B's screen.
6. **Given** User A moves their cursor very rapidly, **When** cursor events are sent to the server, **Then** the events are throttled to at most one per ~33 ms (not every pixel movement).
7. **Given** User A pans or zooms the canvas, **When** User B's cursor position was previously visible, **Then** the cursor indicator moves to the correct canvas-relative position (world coordinates are preserved).

---

### User Story 2 — See Who Is Online in the Room (Priority: P2)

A user opens a shared whiteboard room and wants to know how many people are currently collaborating. A visible panel or indicator lists the names and colors of all connected users, updating automatically as people join or leave.

**Why this priority**: Knowing who is in the room builds social context and trust. It is essential for understanding whose changes are appearing in real time.

**Independent Test**: Open the same room URL in two browser tabs. Verify both tabs show each other in the online user list. Close one tab and verify the other tab's list updates to reflect the departure.

**Acceptance Scenarios**:

1. **Given** a user joins a room, **When** they load the whiteboard, **Then** they see an online user panel listing every currently connected user (name + color badge).
2. **Given** a second user joins the same room, **When** they connect, **Then** all previously connected users' panels update to include the new user.
3. **Given** a user is listed in the online panel, **When** that user leaves (closes tab / disconnects), **Then** all remaining users' panels remove that user within ~200 ms.
4. **Given** a user is alone in a room, **When** they view the online panel, **Then** they see only themselves listed.

---

### Edge Cases

- What happens when a user's cursor moves off the canvas area? — The cursor position is still transmitted and rendered at the (possibly off-viewport) world coordinate; the indicator may not be visible but no error occurs.
- What happens when a user disconnects unexpectedly (network drop)? — The server detects the disconnect and broadcasts a leave event; the cursor and user entry are removed from all remaining clients.
- What happens if cursor events are received before the session's presence info (name/color) is known? — The cursor is buffered or ignored until presence info arrives; no anonymous cursor is rendered.
- What happens in a room with 50 simultaneous users? — All cursor and join/leave events are relayed correctly; performance degrades gracefully (throttling limits network load).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The client MUST send the cursor's world-coordinate position to the server at a throttled rate, no more than once per ~33 ms.
- **FR-002**: Cursor positions MUST be transmitted as world coordinates (independent of local camera zoom/pan).
- **FR-003**: Cursor data is ephemeral — it MUST NOT be stored in the elements store or persisted anywhere.
- **FR-004**: The server MUST relay each cursor event to all other sessions in the same room without storing it.
- **FR-005**: The client MUST render a cursor indicator for each remote user currently in the room, positioned at their reported world coordinate.
- **FR-006**: Each cursor indicator MUST display the remote user's name and use their assigned color.
- **FR-007**: The client MUST NOT render a remote cursor for the local user's own session.
- **FR-008**: Each session MUST be assigned a unique name and color at connection time (generated client-side; no auth required in P2).
- **FR-009**: The server MUST broadcast a join event (with session name + color) to all room members when a new client joins.
- **FR-010**: The server MUST broadcast a leave event to all room members when a client disconnects.
- **FR-011**: The client MUST maintain and render an online user list (name + color badge) that reflects the current room membership.
- **FR-012**: The online user list MUST update in real time when users join or leave the room.

### Key Entities

- **Presence**: Represents a connected user's ephemeral session state — includes `sessionId`, `name`, `color`, and `cursor` position (`{x, y}` in world coords or `null`). Matches the `Presence` type in `@vdt/shared`.
- **RemoteCursors**: A client-side map from `sessionId` to `Presence`, held in transient interaction state (`interaction.store.ts`). Used to render cursor overlays.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Remote cursor indicators appear and update within ~100 ms of the originating cursor movement on a local/LAN connection.
- **SC-002**: Each remote cursor displays the correct name and color matching the session that generated it.
- **SC-003**: The online user list updates within ~200 ms when any user joins or leaves the room.
- **SC-004**: Cursor transmission does not exceed ~30 events per second per user regardless of mouse movement speed.
- **SC-005**: Cursor overlays do not intercept mouse events or interfere with canvas drawing, selection, or pan interactions.

## Assumptions

- No authentication in P2; session identity (name + color) is generated client-side at connection time using a random-name/color scheme.
- Name and color are included in the join payload sent to the server and broadcast to peers; the server does not generate them.
- The `Presence` type from `@vdt/shared` is the data contract for all cursor/presence payloads.
- Remote cursors are rendered as an overlay layer on top of the canvas SVG layer; they do not affect `zIndex` or element rendering.
- The server operates in-memory with no persistence; cursor state is fully ephemeral.
- Up to ~50 concurrent users per room (per NFR in SPECS.md §14).
- World-to-screen coordinate conversion uses the shared camera from `camera.store.ts` to position cursor overlays on screen.
