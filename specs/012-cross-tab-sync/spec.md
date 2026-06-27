# Feature Specification: Cross-Tab Sync (BroadcastChannel)

**Feature Branch**: `feat/cross-tab-sync`

**Created**: 2026-06-26

**Status**: Draft

> **[P2 SUPERSEDED]** BroadcastChannel cross-tab sync is no longer active as of P2.
> Multiple tabs connecting to the same room are now synced via Socket.IO through the backend.
> `initBroadcastChannel` / `stopBroadcastChannel` are `@deprecated` — kept for reference only.
> The `applyRemoteElements` LWW function introduced here is still actively used by the Socket.IO path.

**Input**: User description: "P1B-05: Cross-tab sync (BroadcastChannel) — changes in one tab appear in other same-browser tabs via applyRemoteElements with LWW reconciliation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Basic Cross-Tab Element Sync (Priority: P1)

A user has the whiteboard open in two browser tabs simultaneously. When they draw, move, resize, or delete shapes in Tab A, those changes automatically appear in Tab B without any manual refresh — and vice versa.

**Why this priority**: This is the entire purpose of the feature. Without basic sync working, nothing else matters.

**Independent Test**: Open two tabs to the same whiteboard, create a shape in Tab A, verify it appears in Tab B within ~100 ms.

**Acceptance Scenarios**:

1. **Given** Tab A and Tab B are both open with the whiteboard, **When** a new shape (rectangle, ellipse, line, text, etc.) is created in Tab A, **Then** that shape appears in Tab B within ~100 ms.
2. **Given** an element exists in both tabs, **When** it is moved or resized in Tab A, **Then** its updated position/size appears in Tab B.
3. **Given** an element exists in both tabs, **When** it is soft-deleted in Tab A, **Then** the element is also removed from the canvas in Tab B.
4. **Given** an element's style properties (stroke color, fill, opacity, etc.) are changed in Tab A, **When** the change is committed, **Then** the updated style appears in Tab B.

---

### User Story 2 — Last-Write-Wins Conflict Resolution (Priority: P1)

When both tabs modify the same element nearly simultaneously, the system must deterministically converge to the same state using LWW rules, so no tab is stuck with a stale version.

**Why this priority**: Without conflict resolution, concurrent edits in two tabs would cause inconsistent state — one tab would show the old version indefinitely.

**Independent Test**: Manually trigger two concurrent patches with crafted `version`/`versionNonce` values; verify the store retains the winning element.

**Acceptance Scenarios**:

1. **Given** the same element in both tabs with `version=5`, **When** Tab A patches it to `version=6` and Tab B receives a remote `version=6` with a lower `versionNonce`, **Then** Tab B applies the remote change (lower nonce wins the tie).
2. **Given** the same element in both tabs, **When** Tab B receives a remote element with a lower `version` than the local element, **Then** the remote update is ignored (higher version wins).
3. **Given** two remote updates arrive for the same element, **When** both have `version=7` and different nonces, **Then** the one with the lower `versionNonce` is kept (deterministic tiebreak).

---

### User Story 3 — Skip Active Elements During Interaction (Priority: P2)

When a user is actively dragging, resizing, rotating, or text-editing an element in Tab B, remote updates for that specific element from Tab A are dropped (ignored) until the interaction completes — preventing janky position jumps mid-action. The next mutation from Tab A after the interaction ends will carry the current state and will be applied normally.

**Why this priority**: Without this guard, remote updates would interrupt live interactions, causing the element to jump to the remote position while the user is mid-drag.

**Independent Test**: Start dragging an element in Tab B, trigger a remote update for the same element from Tab A, verify the element in Tab B does not jump during the drag.

**Acceptance Scenarios**:

1. **Given** the user is actively dragging an element in Tab B, **When** a remote update arrives for that same element, **Then** the remote update is ignored until the drag completes.
2. **Given** the user is actively resizing or rotating a selected element in Tab B, **When** a remote update arrives for that element, **Then** it is skipped; after the interaction ends, subsequent remote updates for that element are processed normally.
3. **Given** the user is text-editing an element in Tab B, **When** a remote update arrives for that element's text or position, **Then** the remote update is ignored while editing is in progress.

---

### User Story 4 — Remote Changes Persist Across Reload (Priority: P2)

Changes received from another tab via BroadcastChannel are also saved to localStorage. If Tab B reloads after receiving remote changes, it should restore those changes — not revert to its pre-sync state.

**Why this priority**: Without persistence, sync is "session-only": a reload would silently lose all changes received from other tabs, confusing users.

**Independent Test**: Apply remote changes to Tab B, close Tab A, reload Tab B, verify remote changes are still present.

**Acceptance Scenarios**:

1. **Given** Tab B has received and applied remote elements from Tab A, **When** Tab B is reloaded, **Then** the remotely applied elements are still present on the canvas.
2. **Given** an element was soft-deleted via a remote update in Tab B, **When** Tab B is reloaded, **Then** the element remains absent from the canvas.

---

### Edge Cases

- What happens when the same tab receives its own broadcast? (BroadcastChannel inherently does not echo to the sender — no special handling needed.)
- What if BroadcastChannel is not supported in the browser? (Fail gracefully: sync simply does not activate; the whiteboard still functions as a local single-tab editor.)
- What happens when Tab A sends a large batch of changes (e.g., creating 50 shapes rapidly)? Each mutation event broadcasts only the affected elements; Tab B applies them incrementally.
- What if Tab B applies a remote element with an `id` not yet in its store? The element is added as a new element (no LWW comparison needed — it is unambiguously new).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST broadcast every element mutation (create, patch, delete, batch update) to other same-browser tabs using `BroadcastChannel`.
- **FR-002**: The system MUST apply incoming broadcasts using a single shared function `applyRemoteElements(incoming: Element[])` that implements LWW conflict resolution.
- **FR-003**: `applyRemoteElements` MUST use LWW: an incoming element is applied only if its `version` is strictly greater than the local version, OR `version` is equal and `versionNonce` is strictly less than the local nonce.
- **FR-004**: `applyRemoteElements` MUST skip any element that is currently being actively interacted with (dragged, resized, rotated, or text-edited) in the local tab.
- **FR-005**: Remote changes applied to the store MUST trigger localStorage persistence so they survive a tab reload.
- **FR-006**: The BroadcastChannel listener MUST NOT re-broadcast received remote messages (no infinite loop across tabs).
- **FR-007**: The `applyRemoteElements` function MUST be a standalone implementation reusable by the Phase 2 Socket.IO sync path — not duplicated.
- **FR-008**: The BroadcastChannel MUST be closed/cleaned up when the app unmounts.

### Key Entities

- **Element**: The core data unit (`id`, `type`, `x`, `y`, `width`, `height`, `angle`, `version`, `versionNonce`, `updatedAt`, `isDeleted`, `props`, …). Only `Element[]` crosses tab boundaries.
- **BroadcastChannel message**: `{ elements: Element[] }` — the serialized payload sent/received between tabs.
- **LWW winner**: The element version that "wins" conflict resolution (higher `version`; tiebreak on lower `versionNonce`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A change in Tab A appears in Tab B within 100 ms under normal browser conditions (same-browser, same-machine).
- **SC-002**: When both tabs concurrently edit the same element, all tabs converge to an identical final state within one LWW cycle.
- **SC-003**: An element under active interaction in Tab B is never overwritten by a concurrent remote update from Tab A during the interaction.
- **SC-004**: Remote changes received by Tab B are present on the canvas after Tab B reloads.
- **SC-005**: The `applyRemoteElements` function is the single implementation used for both BroadcastChannel (Phase 1B) and Socket.IO (Phase 2) sync — zero code duplication.

## Assumptions

- Only same-browser tabs are in scope (BroadcastChannel is same-origin, same-browser by spec). Cross-browser/cross-machine sync is Phase 2.
- A single whiteboard scene is assumed (no multi-room routing in Phase 1B). All tabs share the same `BroadcastChannel` name.
- The broadcast payload is the full `Element[]` array of affected elements for each mutation event (not a diff format). This is sufficient for Phase 1B scale (tens of shapes).
- History (undo/redo) does not capture remote changes — only local mutations are undoable in Phase 1B.
- BroadcastChannel browser support is assumed for modern browsers (Chrome 54+, Firefox 38+, Safari 15.4+). No polyfill is provided.
