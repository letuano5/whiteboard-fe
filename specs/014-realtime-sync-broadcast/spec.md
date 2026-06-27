# Feature Specification: Realtime Sync & Broadcast

**Feature Branch**: `feat/online-room`

**Created**: 2026-06-27

**Status**: Draft

**Input**: User description: "[P2-02] Realtime broadcast (reuse apply-remote): Sau mutation → gửi element (đã version++) lên server qua socket. Nhận event từ server → applyRemoteElements (cùng hàm P1B); render < ~200ms. [BE] Server nhận element từ client → broadcast cho toàn phòng (trừ sender). [P2-03] Optimistic local update: Thao tác áp ngay cục bộ, không chờ server (cảm giác tức thì). [P2-04] LWW conflict (version + nonce): applyRemoteElements áp LWW: version cao hơn thắng; hoà thì versionNonce nhỏ hơn thắng (deterministic). Mọi client hội tụ cùng một state. [P2-05] Từ chối remote khi đang sửa: Element đang kéo/resize/sửa cục bộ bỏ qua remote update giữa chừng; kết thúc thì hội tụ theo LWW."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — See Others' Changes in Real Time (Priority: P1)

A user is collaborating in a whiteboard room. When their teammate draws, moves, or deletes a shape, the change appears on their own canvas within a moment — without reloading the page.

**Why this priority**: This is the core collaboration promise. Without real-time propagation, the app is single-user-only; nothing else in Phase 2 delivers value.

**Independent Test**: Open the same room URL in two browser tabs. Draw a shape in Tab A. Verify the shape appears in Tab B within ~200 ms.

**Acceptance Scenarios**:

1. **Given** two users are in the same room, **When** User A creates a new element, **Then** User B sees the new element appear on their canvas within ~200 ms.
2. **Given** two users are in the same room, **When** User A moves an existing element, **Then** User B sees the element at its new position.
3. **Given** two users are in the same room, **When** User A deletes an element, **Then** User B's canvas reflects the deletion.
4. **Given** two users are in different rooms, **When** User A makes a change, **Then** User B (in the other room) does NOT receive that change.

---

### User Story 2 — Instant Local Feedback (Optimistic Update) (Priority: P1)

A user performs an action (draws, moves, resizes, deletes). The canvas responds instantly — the user sees the result of their action immediately, without waiting for the server to acknowledge it.

**Why this priority**: Perceived responsiveness is critical. A whiteboard that lags on every stroke or move feels broken even if the underlying data is correct.

**Independent Test**: In a room with simulated slow network, draw a shape. Verify the shape appears on the canvas immediately (not after a server round-trip).

**Acceptance Scenarios**:

1. **Given** a user creates, moves, or deletes an element, **When** they perform the action, **Then** the canvas reflects the change immediately — before any server response.
2. **Given** two users make simultaneous changes, **When** each user acts, **Then** each user sees their own change immediately; the final agreed state appears within ~200 ms.

---

### User Story 3 — Conflict Resolution (Last-Write-Wins) (Priority: P1)

Two users edit the same element at nearly the same time. The system resolves the conflict automatically and deterministically so that all participants end up with the same element state.

**Why this priority**: Without a conflict resolution rule, simultaneous edits cause divergent state — different users see different canvases, which breaks collaboration.

**Independent Test**: Simulate two concurrent edits to the same element with known version numbers. Verify the element ends in the expected state on both clients, and both clients agree on that state.

**Acceptance Scenarios**:

1. **Given** two clients each hold version N of an element, **When** Client A applies version N+1 and Client B receives Client A's update, **Then** Client B adopts Client A's version (higher version wins).
2. **Given** two clients simultaneously produce version N+1 of the same element (race), **When** each client applies the other's update, **Then** both clients converge to the same element state using a deterministic tiebreaker (lower version nonce wins).
3. **Given** a client receives an incoming update with a lower version than what it already holds, **When** the update arrives, **Then** the local (higher-version) state is preserved; the stale update is ignored.

---

### User Story 4 — Protect Local Edits in Progress (Priority: P2)

A user is actively dragging, resizing, or typing text on an element. A remote update for the same element arrives simultaneously. The user's in-progress edit is not disrupted — the remote update is deferred until the user finishes.

**Why this priority**: Overwriting an element mid-drag with a remote value causes jarring, disorienting jumps. It makes the whiteboard feel unreliable.

**Independent Test**: Start dragging an element (hold the mouse button down). Trigger a remote update to that same element. Verify the element does not jump or reset while dragging. Release the mouse; verify the final state converges.

**Acceptance Scenarios**:

1. **Given** a user is dragging an element, **When** a remote update for that element arrives, **Then** the element does NOT jump to the remote position; the drag continues uninterrupted.
2. **Given** a user is resizing an element, **When** a remote update for that element arrives, **Then** the resize continues uninterrupted; the remote update is applied (or superseded via LWW) once the resize completes.
3. **Given** a user is editing text inside an element, **When** a remote update for that element arrives, **Then** the text-edit session continues uninterrupted.
4. **Given** a user finishes an in-progress edit (releases mouse / commits text), **When** the edit completes, **Then** the element converges to the correct final state using LWW.

---

### Edge Cases

- What if the network drops briefly? → Elements already in local state remain visible; reconnect and resync are handled by the socket layer (full reconnect recovery is Phase 3A).
- What if two clients produce the same version and the same nonce? → The nonce space (0–999,999,999) makes collision probability negligible for Phase 2 scale; this edge case is acceptable.
- What if a remote update arrives for an element that does not exist locally? → The element is added to local state (new-element path in applyRemoteElements).
- What if a user is dragging an element that is also being deleted remotely? → The remote deletion is deferred; once the drag completes, LWW determines the outcome (the delete will win if its version is higher).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every element change made locally MUST be transmitted to the server so it can be relayed to other room members.
- **FR-002**: Element changes received from other room members MUST be applied to the local canvas without requiring a page reload.
- **FR-003**: Local element changes MUST be reflected on the canvas immediately, without waiting for the server to acknowledge the change.
- **FR-004**: The system MUST resolve simultaneous element changes deterministically: the change with the higher version number wins; if version numbers are equal, the change with the lower version nonce wins.
- **FR-005**: All clients in the same room MUST converge to the same element state after any sequence of concurrent changes.
- **FR-006**: A remote element change that would overwrite an element currently being dragged, resized, or text-edited MUST be deferred until the local interaction completes.
- **FR-007**: After a local interaction (drag/resize/text-edit) completes, the element state MUST converge via the same LWW rules as any other update.
- **FR-008**: The same conflict-resolution function MUST handle both cross-tab (local) and cross-network (remote) updates — no parallel implementations.

### Key Entities

- **Element**: A drawable object with a unique ID, a `version` counter (monotonically increasing), a `versionNonce` (random tiebreaker), and `updatedAt` timestamp.
- **Mutation Event**: A notification produced by the local mutation pipeline every time an element is created, patched, or deleted; carries the updated `Element[]`.
- **Active Interaction**: A drag, resize, or text-edit session currently in progress on the local client, identified by element ID.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A change made by one user appears on all other users' canvases in the same room within ~200 ms under normal network conditions.
- **SC-002**: After any sequence of concurrent edits to the same element by multiple users, all clients display the same final element state within ~200 ms of the last edit.
- **SC-003**: A user's own canvas updates immediately upon performing an action — with no perceptible delay attributable to server round-trip.
- **SC-004**: An element being actively dragged or resized by a user is never overwritten or repositioned by a remote update while that interaction is in progress.

## Assumptions

- Room membership and socket connectivity are handled by P2-01 (spec 013); this spec assumes the client is already connected and has joined a room.
- The server relays element changes only within the same room (room isolation is a P2-01 requirement).
- No server-side persistence at this phase — rooms are in-memory only (persistence is Phase 3A).
- Authentication and access control are out of scope (Phase 3B).
- The existing mutation pipeline already increments `version` and randomizes `versionNonce` on every change; no changes to the pipeline are needed to support LWW.
- BroadcastChannel (cross-tab) sync continues operating in parallel; the same conflict-resolution function services both paths.
