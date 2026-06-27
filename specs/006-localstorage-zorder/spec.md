# Feature Specification: localStorage Persistence & Z-Order Foundation (P1A-09 + P1A-10)

**Feature Branch**: `feat/local-editor`

**Created**: 2026-06-24

**Status**: Draft

> **[P2 SUPERSEDED — elements only]** localStorage persistence for `elements` is no longer active as of P2.
> Backend in-memory state (sent via `ROOM_SNAPSHOT` on join) is now the source of truth for elements.
> `initLocalStoragePersistence` / `startLocalStoragePersistence` are `@deprecated` — kept for reference only.
> Z-Order foundation (P1A-10) remains active and unaffected.
>
> **Camera** is still persisted in localStorage, but per-room and separately from elements:
> key `VDT_CAMERA_{roomId}` — managed by `sync/camera-persistence.ts`, not the deprecated `local-storage.ts`.
> Camera is per-user preference, not shared state, so localStorage is the correct home for it.

**Input**: User description: "P1A-09 localStorage (single tab) + P1A-10 z-order foundation. Hai tính năng từ Phase 1A của whiteboard app."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Session Survival After Reload (Priority: P1)

A user spends time drawing shapes and panning/zooming the canvas. They accidentally close the tab or reload the page. When they return, everything they drew is exactly where they left it — shapes, styles, and camera position are all restored automatically with no manual save action required.

**Why this priority**: Without this, all work is lost on every reload. This is the most fundamental persistence requirement for a usable local editor. It also acts as the foundation for future cross-tab sync (P1B) and server persistence (P3A).

**Independent Test**: Draw two shapes, zoom in, pan, then reload the page. Both shapes reappear at correct positions with correct styles, and the viewport is restored.

**Acceptance Scenarios**:

1. **Given** a user has created one or more shapes on the canvas, **When** the page is reloaded, **Then** all non-deleted shapes are present with the same properties (position, size, type, style) as before the reload.
2. **Given** a user has panned and zoomed the canvas, **When** the page is reloaded, **Then** the camera position and zoom level are restored to what they were before the reload.
3. **Given** a user has deleted a shape (soft delete), **When** the page is reloaded, **Then** the deleted shape does not reappear on the canvas.
4. **Given** a user creates a new shape, **When** no more than 300 ms have elapsed without further changes, **Then** the shape is persisted (a subsequent immediate reload restores it).
5. **Given** a fresh page load with no prior data in storage, **When** the canvas is displayed, **Then** the canvas starts empty with the default camera (no errors, no crash).

---

### User Story 2 - Visual Stacking Order (Priority: P1)

A user draws multiple overlapping shapes. Shapes drawn later appear on top of earlier ones. When two shapes overlap and the user clicks the overlapping area, the topmost shape is selected — not one hidden beneath.

**Why this priority**: Z-order is the foundation of a correct canvas. Without it, shapes drawn later may be obscured, and click targets are ambiguous.

**Independent Test**: Draw shape A, then draw shape B overlapping A. Shape B visually covers A in the overlap area. Click the overlap — shape B is selected.

**Acceptance Scenarios**:

1. **Given** two shapes A and B where B was drawn after A and they overlap, **When** the user views the canvas, **Then** shape B visually appears on top of shape A in the overlapping area.
2. **Given** two overlapping shapes where shape B has a higher zIndex than shape A, **When** the user clicks in the overlapping area, **Then** shape B is selected (not shape A).
3. **Given** a new shape is about to be created, **When** it is added to the canvas, **Then** its zIndex is strictly greater than the zIndex of every existing shape on the canvas.
4. **Given** the canvas has no shapes, **When** the first shape is created, **Then** its zIndex is a positive integer (≥ 1).

---

### Edge Cases

- What happens if localStorage is full (QuotaExceededError)? The save fails silently — the canvas continues to work but data may not be persisted.
- What happens if localStorage data is corrupted or invalid JSON? The canvas starts empty (as if fresh), without crashing.
- What happens if the stored data schema is from an older version of the app? The canvas starts empty (no partial/broken restore).
- What happens when many shapes exist and all have the same zIndex? The existing render order (array order) is used as a tiebreaker for display; hit-test may be non-deterministic but this condition does not occur in normal use (each createElement assigns max+1).

## Requirements *(mandatory)*

### Functional Requirements

**P1A-09 — localStorage Persistence**

- **FR-001**: The system MUST save the current elements array and camera state to localStorage automatically after each change, with a debounce of approximately 300 ms.
- **FR-002**: The system MUST restore the saved elements array and camera state from localStorage on page load, before the canvas is first rendered.
- **FR-003**: The system MUST exclude soft-deleted elements (isDeleted: true) from the visible canvas after restore — deleted elements may be stored but MUST NOT reappear.
- **FR-004**: If no saved data exists, the system MUST initialize with an empty elements array and the default camera without error.
- **FR-005**: If saved data is corrupted or unparseable, the system MUST fall back to an empty canvas without error.
- **FR-006**: Save and restore MUST cover the complete element data (all fields of the Element type) and the complete camera state (x, y, zoom).

**P1A-10 — Z-Order Foundation**

- **FR-007**: The render order of shapes MUST follow ascending zIndex — shapes with lower zIndex are rendered first (behind); shapes with higher zIndex are rendered last (in front).
- **FR-008**: When a new shape is created, its zIndex MUST be strictly greater than the maximum zIndex of all existing non-deleted shapes.
- **FR-009**: When multiple shapes overlap at a click point, the shape with the highest zIndex MUST be selected (hit-test priority).

### Key Entities

- **Element**: A drawable object on the canvas with fields including `id`, `type`, `x`, `y`, `width`, `height`, `zIndex`, `props`, `version`, `versionNonce`, `updatedAt`, `isDeleted`, etc.
- **Camera**: The viewport state with fields `x` (world offset), `y` (world offset), `zoom` (scale factor, clamped to [0.1, 8]).
- **Persisted Scene**: The serialized pair `{ elements: Element[], camera: Camera }` written to and read from localStorage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a page reload, 100% of shapes that were visible before the reload are visible again, with identical positions, sizes, and styles.
- **SC-002**: After a page reload, the canvas viewport (pan and zoom) is restored to within the same values as before the reload.
- **SC-003**: A shape created immediately before a 300 ms wait and then a reload is successfully restored (debounce flushes within the window).
- **SC-004**: A shape drawn after another always appears visually on top of the earlier shape when they overlap.
- **SC-005**: Clicking an overlapping region always selects the topmost visible shape (no mis-selection of a shape below).

## Assumptions

- Single-tab use only for P1A-09; cross-tab sync (BroadcastChannel) is a P1B concern.
- The localStorage key is a fixed constant string `VDT_WHITEBOARD_SCENE`; no multi-room or multi-board isolation is required at this phase.
- localStorage is available in the target browser environment; no IndexedDB or other fallback is required.
- The debounce timer of ~300 ms matches the spec; exact millisecond precision is not required.
- P1A-10 z-order behaviors (render sort, createElement max+1, hit-test priority) are already implemented in the codebase; this feature's scope for P1A-10 is test coverage and documentation of those behaviors.
- UI controls for changing zIndex (bring to front, send to back, etc.) are deferred to P2.5-02.
