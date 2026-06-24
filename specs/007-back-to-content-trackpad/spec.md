# Feature Specification: Back to Content & Trackpad Support

**Feature Branch**: `007-back-to-content-trackpad`

**Created**: 2026-06-24

**Status**: Draft

**Input**: P1A-11 — Back to content & Trackpad support

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Back to Content Button (Priority: P1)

A user is working on a whiteboard with shapes drawn. They accidentally pan/zoom too far and can no longer see any of their content. They need a quick way to return to their work.

**Why this priority**: Core navigation rescue feature — without it, users who pan to empty space cannot easily find their content, leading to frustration and potential data loss perception.

**Independent Test**: Can be fully tested by: (1) placing shapes on canvas, (2) panning far away until no shapes are visible, (3) verifying a "Back to content" button appears, (4) clicking it and verifying the camera fits all content with padding.

**Acceptance Scenarios**:

1. **Given** shapes exist on canvas and all shapes are outside the current viewport, **When** the user views the canvas, **Then** a "Back to content" button is visible in the UI overlay.
2. **Given** the "Back to content" button is visible, **When** the user clicks it, **Then** the camera animates/moves to show all existing shapes, with light padding on all sides, and no shape is cropped.
3. **Given** no shapes exist on the canvas (canvas is empty), **When** the user views the canvas, **Then** the "Back to content" button is NOT shown.
4. **Given** at least one shape is visible within the current viewport, **When** the user views the canvas, **Then** the "Back to content" button is NOT shown.
5. **Given** the canvas has only soft-deleted shapes (`isDeleted: true`), **When** the user views the canvas, **Then** the "Back to content" button is NOT shown (deleted shapes do not count as content).

---

### User Story 2 — Smooth Trackpad Zoom (Priority: P2)

A user with a trackpad (MacBook or similar) uses pinch gestures or Ctrl+scroll to zoom the canvas. Currently the zoom is too fast and jumpy — they want precise, smooth zoom control.

**Why this priority**: Trackpad users represent a significant portion of the audience; poor zoom UX degrades the core interaction.

**Independent Test**: Can be tested independently by: using a trackpad pinch or Ctrl+scroll and observing that zoom increments are small and smooth rather than large jumps.

**Acceptance Scenarios**:

1. **Given** the user uses a trackpad pinch gesture (ctrlKey true + wheel event), **When** zooming in/out, **Then** the zoom changes gradually — small deltas produce small zoom steps (sensitivity reduced vs. mouse wheel).
2. **Given** the user uses Ctrl/Cmd + mouse wheel, **When** scrolling, **Then** zoom changes smoothly without large jumps.
3. **Given** any zoom gesture, **When** zoom would exceed the maximum (8) or minimum (0.1), **Then** zoom is clamped at the boundary.

---

### User Story 3 — Trackpad Two-Finger Pan (Priority: P2)

A user with a trackpad uses a two-finger scroll gesture (without Ctrl/Cmd) to navigate the canvas horizontally and vertically.

**Why this priority**: Two-finger pan is the primary navigation method for trackpad users; supporting it makes the canvas feel native on modern laptops.

**Independent Test**: Can be tested independently by: two-finger scrolling without Ctrl held and observing the canvas pans in the scroll direction.

**Acceptance Scenarios**:

1. **Given** the user performs a two-finger scroll (no Ctrl/Cmd key) on the canvas, **When** scrolling in any direction, **Then** the canvas pans by the scroll delta (deltaX and deltaY) — no zoom occurs.
2. **Given** the user performs a two-finger scroll (no Ctrl/Cmd key), **When** scrolling horizontally, **Then** the canvas moves left/right proportionally to deltaX.
3. **Given** the user performs a two-finger scroll (no Ctrl/Cmd key), **When** scrolling vertically, **Then** the canvas moves up/down proportionally to deltaY.
4. **Given** the user holds Ctrl or Cmd while scrolling, **When** the wheel event fires, **Then** the event is treated as zoom (not pan).
5. **Given** a trackpad pinch gesture (ctrlKey set by browser), **When** the gesture fires, **Then** it is treated as zoom (not pan).

---

### User Story 4 — Middle-Click Pan Hint (Priority: P3)

A user in Select mode is not aware they can pan the canvas using the middle mouse button. A small hint text informs them of this shortcut.

**Why this priority**: Discoverability aid — lower priority than core functionality but improves onboarding for new users.

**Independent Test**: Can be tested independently by: selecting the Select tool and verifying a hint text appears somewhere on the canvas UI.

**Acceptance Scenarios**:

1. **Given** the user has the Select tool active, **When** viewing the canvas, **Then** a small hint text "Click chuột giữa để scroll canvas" is visible in the canvas UI.
2. **Given** the user switches to any other tool (pan, rectangle, etc.), **When** viewing the canvas, **Then** the hint text is NOT shown.

---

### Edge Cases

- What happens when all shapes are deleted (soft-deleted) while the "Back to content" button is visible? → Button disappears immediately.
- What if the canvas has a single shape at extreme world coordinates (e.g., x=1,000,000)? → "Back to content" still fits exactly that shape with padding.
- What if pinch zoom delta is extremely large (rapid gesture)? → Still clamped within [0.1, 8]; sensitivity factor prevents runaway zoom.
- What if the user pans to a half-visible state (some shapes partially in viewport)? → Button is NOT shown (at least some content is visible).
- What if `deltaMode` is not pixel-based (LINE or PAGE)? → Normalize deltaX/deltaY to pixel equivalents before applying.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When ALL non-deleted elements are outside the current viewport bounding box, the canvas MUST display a "Back to content" button.
- **FR-002**: When at least one non-deleted element intersects the current viewport, the "Back to content" button MUST NOT be displayed.
- **FR-003**: When the element store contains no non-deleted elements, the "Back to content" button MUST NOT be displayed.
- **FR-004**: Clicking "Back to content" MUST update the camera so that the bounding box of all non-deleted elements is fully visible with uniform padding (approximately 10–15% of the smaller viewport dimension on each side).
- **FR-005**: Wheel events WITHOUT Ctrl/Cmd held MUST pan the canvas by `(deltaX, deltaY)`, not zoom.
- **FR-006**: Wheel events WITH Ctrl/Cmd held, OR events flagged as pinch by the browser (ctrlKey=true from trackpad pinch), MUST zoom the canvas.
- **FR-007**: Trackpad zoom sensitivity MUST be reduced so that typical pinch deltas produce small incremental zoom steps (factor applied to raw delta before computing new zoom level).
- **FR-008**: All zoom operations MUST clamp the zoom level within [0.1, 8].
- **FR-009**: While the Select tool is active, the canvas MUST display the hint text "Click chuột giữa để scroll canvas".
- **FR-010**: The hint text MUST disappear when the user switches to any tool other than Select.

### Key Entities

- **Camera** `{ x, y, zoom }`: the shared viewport transform used by all rendering layers. "Back to content" updates this state.
- **Viewport bounding box**: derived from camera state + canvas container dimensions; used to determine whether any elements are visible.
- **Element bounding box**: per-element `{ x, y, width, height }` in world coordinates; union of all non-deleted elements' boxes drives the "fit" calculation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can return to content in 1 click after panning/zooming to an empty area — measured by the presence and functionality of the "Back to content" button.
- **SC-002**: Two-finger trackpad scroll pans the canvas on every scroll event without zooming — verified by deltaX/deltaY being applied to camera position, not zoom level, when Ctrl/Cmd is not held.
- **SC-003**: Trackpad zoom sensitivity is perceptibly smoother than raw delta — quantified by the applied delta factor being ≤ 0.01 per wheel event unit (vs. a typical raw factor of ~0.05).
- **SC-004**: The "Click chuột giữa" hint is visible to 100% of users in Select mode without needing to discover it organically.
- **SC-005**: No regression in existing mouse-wheel zoom behavior (Ctrl + scroll still zooms as before).

## Assumptions

- The canvas container's pixel dimensions are accessible at runtime to compute the viewport bounding box.
- "Visible" means an element's bounding box intersects the viewport bounding box by at least 1 pixel; partially visible counts as visible (button hidden).
- Soft-deleted elements (`isDeleted: true`) are excluded from all calculations (back-to-content and visibility check).
- The "Back to content" fit uses a simple zoom-to-fit calculation (no animation required for MVP; smooth transition is a nice-to-have).
- The middle-mouse-button pan behavior itself already exists; this task only adds the hint text.
- `deltaMode` normalization: if `event.deltaMode === 1` (LINE), multiply delta by 16; if `event.deltaMode === 2` (PAGE), multiply by the container height/width.
