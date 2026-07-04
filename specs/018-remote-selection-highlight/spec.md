# Feature Specification: Remote Selection Highlight & Draft Preview

**Feature Branch**: `018-remote-selection-highlight`

**Created**: 2026-06-28

**Status**: Draft

**Feature ID**: P2.5-04

## User Scenarios & Testing *(mandatory)*

### User Story 1 — See peers' selected elements highlighted (Priority: P1)

When a collaborator selects one or more elements on the shared whiteboard, other participants can see
a colored border around those elements matching that collaborator's assigned color, so they understand
what the collaborator is focused on.

**Why this priority**: Awareness of peers' focus is the core goal of P2.5-04. Without this, remote
collaboration is blind — users cannot tell what their teammates are looking at or about to change.

**Independent Test**: Open the whiteboard in two browser tabs. In tab A, select an element using the
select tool. Tab B should immediately show a colored highlight border around that element, using tab A's
user color. When tab A deselects, the highlight in tab B disappears.

**Acceptance Scenarios**:

1. **Given** user A and user B are in the same room, **When** user A selects a single element, **Then** user B sees a solid colored border around that element using user A's color.
2. **Given** user A has multiple elements selected, **When** user B observes the canvas, **Then** user B sees the colored highlight around all of user A's selected elements.
3. **Given** two remote users each have different elements selected simultaneously, **When** user C observes, **Then** user C sees each user's selections highlighted in their respective colors at the same time.
4. **Given** user A deselects all elements (clicks on empty canvas), **When** user B observes, **Then** the colored highlight from user A disappears from user B's view.
5. **Given** user A leaves the room, **When** user B observes the canvas, **Then** all highlights from user A disappear.

---

### User Story 2 — See peers' in-progress element changes (Priority: P2)

When a collaborator is dragging, resizing, or creating an element, other participants can see the
element move or resize in real time as a faint preview, so they are aware of ongoing changes before
they are committed.

**Why this priority**: Without draft previews, element updates appear to "jump" to new positions
only after the user finishes their gesture — which is disorienting. Showing the in-flight state
creates a smoother shared experience.

**Independent Test**: Open two tabs. In tab A, start dragging an existing element. Tab B should show
that element animating to follow the drag. When tab A releases the drag, tab B sees the final committed
position via the existing element-update broadcast.

**Acceptance Scenarios**:

1. **Given** user A begins dragging an element, **When** user B observes, **Then** user B sees the element move in real time (as a draft ghost) with a small visual indicator (opacity, border) distinguishing it from committed state.
2. **Given** user A is resizing an element, **When** user B observes, **Then** user B sees the element resize in real time as a draft preview.
3. **Given** user A is creating a new element by drawing (drag to create), **When** user B observes, **Then** user B sees the in-progress shape appear as a ghost element before user A releases.
4. **Given** user A cancels a drag (e.g. presses Escape), **When** user B observes, **Then** the ghost/draft preview disappears and the element returns to its last committed position.
5. **Given** user A commits the change (releases pointer), **When** the commit lands on user B, **Then** the ghost preview is replaced by the committed element with full opacity.

---

### Edge Cases

- What if the element being highlighted by a remote user is deleted by the local user? The highlight should disappear with the element.
- What if two remote users select the same element? Both colored borders should stack or overlay.
- What happens when the room has no other participants? Remote selection layer renders nothing; no performance cost.
- What if a draft update arrives for an element that does not yet exist on the observer's client? The draft ghost is discarded silently.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST broadcast each client's current `selectedIds` to all other participants in the same room whenever the local selection changes.
- **FR-002**: The system MUST render a colored selection border around each element that a remote participant has selected, using that participant's assigned color.
- **FR-003**: Remote selection borders MUST be visually distinct from the local user's own selection overlay (different style: no resize handles, no rotate handle, solid colored outline only — no dashes).
- **FR-004**: The system MUST support showing simultaneous remote selections from multiple users, each in their own color.
- **FR-005**: Remote selection highlights MUST disappear when the remote user deselects, switches tool away from select, or leaves the room.
- **FR-006**: The system MUST broadcast in-progress (draft) element state — position, size — while a user is dragging or resizing, at a throttled rate.
- **FR-007**: Draft element previews from remote users MUST be rendered at 50% opacity with a 1 px solid colored border matching the peer's color to distinguish from committed elements.
- **FR-008**: Draft previews MUST NOT be written into the committed elements store — they are transient and must disappear when a commit arrives or the remote user cancels.
- **FR-009**: `selectedIds` MUST be emitted as part of the `cursor-move` event payload.
- **FR-010**: Draft element broadcasts MUST be throttled (≤ 50 ms interval) to avoid flooding the server.
- **FR-011**: If an element selected locally also has a remote draft for the same element id, the local selection bbox MUST render against the remote draft geometry rather than the stale committed geometry.
- **FR-012**: Remote draft borders and remote selection borders MUST apply the element's `angle` so bbox orientation matches rotated elements during both committed and in-progress states.

### Key Entities

- **RemotePresence** (already exists as `Presence`): ephemeral record of a remote participant; `selectedIds` field is already defined and carried in the map keyed by `sessionId`.
- **RemoteDraft**: transient, per-session record of an element being mutated by a remote user (id + partial element props); lives in `interaction.store` alongside `remoteCursors`; never persisted or broadcast back.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Remote selection highlights appear within 150 ms of the remote user performing the selection action (end-to-end, single LAN or local loopback).
- **SC-002**: Draft element previews update at a visible frame rate (at minimum one update per 50 ms, ≥ 20 FPS) while the remote user is actively dragging.
- **SC-003**: All remote selection and draft state is cleared within 500 ms of a remote user disconnecting from the room.
- **SC-004**: The feature introduces no observable frame-rate degradation (< 1 dropped frame per second on average) when 5 remote users are actively moving elements simultaneously.
- **SC-005**: Remote selection highlights and draft previews render correctly across all element types supported by the whiteboard (rectangle, ellipse, diamond, text, image, arrow, line, etc.).
- **SC-006**: When two users select the same element and one user drags, resizes, or rotates it, the observing user's local and remote selection bboxes stay attached to the draft preview without using the stale committed bbox.

## Assumptions

- The `Presence` type's `selectedIds: string[]` field is already defined in `@vdt/shared` — no schema change needed for selection broadcast.
- The server already stores and relays `Presence` objects via `cursor-move`/`user-join` — adding `selectedIds` to the `cursor-move` relay is a minimal change.
- Draft element broadcasts use a new lightweight event (e.g., `element-draft`) separate from `element-update` so the receiver can distinguish transient previews from committed state.
- Complex conflict resolution (e.g., two users dragging the same element simultaneously) is out of scope; the last-write-wins rule applies only at commit time — during draft, both ghosts can coexist visually.
- No server-side persistence of draft state is required; drafts are relayed in real time and not stored.
- Only the existing SVG rendering layer is used for draft ghosts (no new Canvas layer required for this phase).
- The feature applies only when the user is connected to a room (Phase 2+ socket session active); single-player / offline mode is unaffected.
