# Feature Specification: Zoom + Pan + Infinite Canvas

**Feature Branch**: `feat/zoom-pan-infinite-canvas`

**Created**: 2026-06-24

**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scroll to Zoom Around Cursor (Priority: P1)

As a whiteboard user, I want to scroll the mouse wheel to zoom in or out, centered on my cursor position, so that I can quickly inspect details or get an overview without the canvas jumping.

**Why this priority**: Core navigation primitive — without zoom, users cannot work on complex diagrams or fine details.

**Independent Test**: Open the whiteboard, place a shape, hover the cursor over it, scroll up (zoom in) and scroll down (zoom out) — the shape stays under the cursor throughout.

**Acceptance Scenarios**:

1. **Given** the whiteboard is open with `zoom = 1.0`, **When** the user scrolls the mouse wheel up while hovering at screen coordinate `(cx, cy)`, **Then** `zoom` increases and the world point under `(cx, cy)` remains at the same screen position.
2. **Given** the whiteboard is at maximum zoom `(zoom = 8)`, **When** the user scrolls up further, **Then** `zoom` stays at `8` (clamped).
3. **Given** the whiteboard is at minimum zoom `(zoom = 0.1)`, **When** the user scrolls down further, **Then** `zoom` stays at `0.1` (clamped).
4. **Given** any zoom level, **When** the user scrolls the mouse wheel down, **Then** `zoom` decreases and the world point under the cursor stays fixed in screen space.

---

### User Story 2 - Pan with Hand Tool (Priority: P1)

As a whiteboard user, I want to drag the canvas using the Hand tool so I can explore shapes placed far from the current viewport.

**Why this priority**: Without pan, the infinite canvas is inaccessible — users are locked to a fixed viewport.

**Independent Test**: Switch to the Hand tool, click-drag on the canvas — the viewport pans smoothly; shapes that were off-screen become visible.

**Acceptance Scenarios**:

1. **Given** the Hand tool is active, **When** the user presses the pointer down and drags by `(Δx, Δy)` in screen space, **Then** the camera pans so the canvas shifts by `(-Δx/zoom, -Δy/zoom)` in world space.
2. **Given** the Hand tool is active, **When** the user releases the pointer, **Then** panning stops and the new camera position is committed.
3. **Given** shapes placed far from the origin (e.g., `x = 5000, y = 5000`), **When** the user pans to that area, **Then** the shapes become visible and interactive.

---

### User Story 3 - Pan with Middle Mouse Button (Priority: P2)

As a whiteboard user with any tool active, I want to hold the middle mouse button and drag to pan, so that I can navigate without switching tools.

**Why this priority**: Power-user shortcut that works regardless of active tool; improves flow.

**Independent Test**: With the Select tool active, press and drag with the middle mouse button — the canvas pans without deselecting or triggering any shape interaction.

**Acceptance Scenarios**:

1. **Given** any tool is active, **When** the user presses and drags with the middle mouse button (button 1), **Then** the canvas pans in the direction of drag.
2. **Given** the user is panning via middle mouse, **When** the button is released, **Then** panning stops; the active tool and selection state are unchanged.

---

### User Story 4 - Space + Drag Temporary Pan (Priority: P3)

As a whiteboard user, I want to hold `Space` while dragging to temporarily pan (regardless of active tool), so I can navigate quickly without clicking the Hand tool button.

**Why this priority**: Standard whiteboard UX convention; reduces context switching.

**Independent Test**: With the Rectangle tool active, hold Space — the cursor changes to a hand; drag pans the canvas; releasing Space restores the Rectangle tool cursor without any shape being drawn.

**Acceptance Scenarios**:

1. **Given** any tool is active, **When** the user holds `Space` and drags on the canvas, **Then** the canvas pans and no shape is created.
2. **Given** the user is in temporary pan mode (Space held), **When** Space is released, **Then** the original tool resumes and no shape is drawn.

---

### Edge Cases

- What happens when zoom is scrolled to exactly `0.1` or `8`? → Clamp silently; no error.
- What happens when panning with no elements on the canvas? → Canvas pans freely (world is infinite).
- What happens if the pointer leaves the SVG while dragging with the Hand tool? → Continue panning via pointer capture; stop on pointer up.
- What if the user presses Space while a text input has focus? → Space must NOT trigger pan — it should type a space character. Pan only activates when the canvas (SVG) has focus.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST update `zoom` on every scroll-wheel event, centered on the current cursor position in screen space.
- **FR-002**: `zoom` MUST be clamped to the range `[0.1, 8]` at all times.
- **FR-003**: When zoom changes, the camera `(x, y)` MUST be adjusted so that the world point under the cursor remains at the same screen position (pivot-point zoom).
- **FR-004**: When the Hand tool is active, pointer down+move MUST pan the camera; pointer up MUST commit the final camera position.
- **FR-005**: Middle mouse button drag MUST pan the camera regardless of the active tool.
- **FR-006**: Space+drag MUST temporarily pan the camera regardless of the active tool, without creating or modifying any element.
- **FR-007**: Panning MUST update the camera `(x, y)` in world units (`Δscreen / zoom`), so the visual shift matches the drag distance at any zoom level.
- **FR-008**: Pointer capture MUST be set on pointer-down for pan operations so that dragging outside the SVG boundary does not break panning.
- **FR-009**: Keyboard space-key pan MUST be suppressed when focus is on any text input, textarea, or contenteditable element.
- **FR-010**: The cursor MUST change to `grab`/`grabbing` while the Hand tool or Space/middle-mouse pan is active.

### Key Entities

- **Camera**: `{ x: number, y: number, zoom: number }` — world-space offset and scale; mutated only via `camera.store.ts` actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Scrolling the mouse wheel zooms the canvas within one frame (~16 ms at 60 fps) with the pivot point held to within 1 screen pixel.
- **SC-002**: Dragging with the Hand tool or middle mouse pans the canvas with no perceptible lag (≤ one frame).
- **SC-003**: After zooming to maximum (`8`) and minimum (`0.1`) and back, all shapes remain at their original world coordinates.
- **SC-004**: Shapes placed at any world coordinate (e.g., `(±50 000, ±50 000)`) are reachable and renderable via pan.
- **SC-005**: Releasing the Space key or middle mouse button fully restores the previous tool state, with zero accidental element mutations.

## Assumptions

- The camera store's `zoomTo(zoom, pivot)` action correctly adjusts `(x, y)` for pivot-point zoom (already verified in the existing implementation).
- `screenToWorld` / `worldToScreen` utility functions are correct and shared across all layers.
- SVG layer is the single event target for mouse/touch events; no separate canvas overlay yet (Canvas overlay is Phase 3C).
- Trackpad pinch-to-zoom is treated as scroll-wheel events by the browser and is covered by FR-001 without additional work.
- Rotation (`angle`) is always `0` in Phase 1A, so no special transform is needed during pan/zoom.
- The existing Hand tool button in the Toolbar is already wired to set `tool = 'hand'`; this feature only needs to handle the pointer events for that tool.
