# Feature Specification: Local Undo / Redo

**Feature Branch**: `feat/local-undo-redo`

**Created**: 2026-06-25

**Status**: Draft

**Input**: User description: "[P1B-06] Undo / Redo (local) — Ctrl/Cmd+Z / Shift+Z; mỗi bước lưu inverse patch; khi apply undo/redo cũng version++."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Undo Last Action (Priority: P1)

As a canvas user, I want to undo my last edit with a single keyboard shortcut so that I can instantly correct mistakes without having to redo my work manually.

**Why this priority**: Undo is the most frequently used correction mechanism in any creative tool. Without it, users must manually reverse every mistake, which is slow and error-prone. This is the core deliverable of the feature.

**Independent Test**: Create a shape, press Ctrl/Cmd+Z — the shape must disappear. This alone delivers the minimum viable undo experience.

**Acceptance Scenarios**:

1. **Given** a shape has just been created, **When** the user presses Ctrl+Z (Windows/Linux) or Cmd+Z (Mac), **Then** the shape is removed from the canvas.
2. **Given** a shape has been moved, **When** the user presses Ctrl/Cmd+Z, **Then** the shape returns to its position before the move.
3. **Given** a shape has been resized or rotated, **When** the user presses Ctrl/Cmd+Z, **Then** the shape reverts to its size/angle before the operation.
4. **Given** a shape has been deleted, **When** the user presses Ctrl/Cmd+Z, **Then** the shape reappears on the canvas.
5. **Given** a shape's style or text has been changed, **When** the user presses Ctrl/Cmd+Z, **Then** the previous style or text is restored.
6. **Given** the undo stack is empty (no actions to undo), **When** the user presses Ctrl/Cmd+Z, **Then** nothing changes and no error is shown.

---

### User Story 2 — Redo Undone Action (Priority: P2)

As a canvas user, I want to redo an action I previously undid so that I can restore work I accidentally reversed.

**Why this priority**: Redo is the natural complement to undo and is expected by every user who uses undo. Without redo, a misplaced undo forces the user to repeat their work.

**Independent Test**: Create a shape, undo it (shape disappears), press Ctrl+Shift+Z — the shape must reappear.

**Acceptance Scenarios**:

1. **Given** the user has undone one action, **When** the user presses Ctrl+Shift+Z (Windows/Linux) or Cmd+Shift+Z (Mac), **Then** the undone action is re-applied.
2. **Given** the redo stack is empty (no undone actions to redo), **When** the user presses Ctrl/Cmd+Shift+Z, **Then** nothing changes and no error is shown.
3. **Given** the user has undone an action and then performed a new canvas action, **When** the user presses Ctrl/Cmd+Shift+Z, **Then** nothing happens — the redo stack is empty because a new action has cleared it.

---

### User Story 3 — Multi-Step Undo / Redo (Priority: P2)

As a canvas user who has performed several edits, I want to undo and redo multiple steps so that I can navigate back and forth through my editing history.

**Why this priority**: Multi-step undo is critical for any non-trivial editing session. Single-step undo alone covers only the simplest mistakes.

**Independent Test**: Perform 5 distinct actions, then press Ctrl/Cmd+Z five times — all 5 actions must be reversed in reverse order.

**Acceptance Scenarios**:

1. **Given** 5 actions have been performed, **When** the user presses Ctrl/Cmd+Z five times, **Then** all 5 actions are reversed, in reverse order (most-recent first).
2. **Given** 3 actions have been undone, **When** the user presses Ctrl/Cmd+Shift+Z twice, **Then** 2 of the 3 undone actions are re-applied in forward order.
3. **Given** the history has reached its maximum capacity (100 steps), **When** the user performs a new action, **Then** the oldest history entry is discarded so the stack stays at 100 entries.

---

### Edge Cases

- What happens when the undo stack is empty? → No visible change; the shortcut press is silently ignored.
- What happens when the redo stack is empty? → No visible change; the shortcut press is silently ignored.
- What happens when the user is typing in the inline text editor or any text input and presses Ctrl+Z? → The browser's native undo for that text field handles the event; the canvas undo system does NOT intercept it.
- Does the undo/redo history persist across page refreshes? → No. History is session-only and resets on reload.
- Does a multi-element batch action (e.g., moving several shapes at once) count as one undo step or multiple? → One undo step per pipeline call. A multi-shape `updateElements` call is one step.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST undo the most recent canvas mutation when the user presses Ctrl+Z (Windows/Linux) or Cmd+Z (Mac).
- **FR-002**: The system MUST redo the most recently undone mutation when the user presses Ctrl+Shift+Z (Windows/Linux) or Cmd+Shift+Z (Mac).
- **FR-003**: Every canvas mutation routed through the mutation pipeline (create, patch, delete, multi-element update) MUST be captured as an individually undoable step.
- **FR-004**: When a new canvas mutation is performed after one or more undos, the redo stack MUST be cleared.
- **FR-005**: Every undo or redo application MUST increment the affected element(s)' version counter (to preserve sync validity for future phases).
- **FR-006**: The undo/redo history MUST support at least 100 steps; when the limit is reached, the oldest entry is discarded.
- **FR-007**: The undo/redo keyboard shortcuts MUST NOT intercept key events while the user is focused inside any `<input>`, `<textarea>`, `<select>`, or `contenteditable` element.
- **FR-008**: The undo/redo history is local and session-only: it is NOT persisted to localStorage and NOT shared across browser tabs.

### Key Entities

- **HistoryEntry**: One reversible step. Stores the element state(s) before the mutation so the action can be reversed, and the state(s) after so it can be re-applied.
- **UndoStack**: Ordered list of `HistoryEntry` items, most-recent at the top. Entries are pushed by every pipeline mutation and popped on undo.
- **RedoStack**: Ordered list of `HistoryEntry` items available for re-application. Populated by undo operations; cleared whenever a new pipeline mutation is committed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can undo any single canvas action performed in the current session with one keyboard shortcut press.
- **SC-002**: A user can redo any previously undone action with one keyboard shortcut press, provided no new action has been performed since the undo.
- **SC-003**: Undo and redo operations complete with no perceptible delay for any canvas with up to the maximum session element count.
- **SC-004**: After 100 undo steps the history limit is enforced: the oldest entry is silently dropped and further undo steps still work correctly.
- **SC-005**: The undo/redo shortcuts produce no effect and trigger no errors when the user is typing in a text input or inline text editor.
- **SC-006**: Performing a new canvas action after undoing clears the redo stack, making redo unavailable until the next undo.

## Assumptions

- "Shift+Z" in the backlog item is shorthand for Ctrl+Shift+Z (Windows/Linux) / Cmd+Shift+Z (Mac) — the modifier key is implied from the surrounding "Ctrl/Cmd+Z" context. Bare Shift+Z alone is not a redo shortcut.
- Each call to a pipeline function (`createElement`, `patchElement`, `deleteElements`, `updateElements`) constitutes exactly one undo step, regardless of how many elements it affects.
- History is not persisted and is intentionally lost on page refresh — durable history (IndexedDB or server-side) is out of scope for this phase.
- Text-editing undo while the inline editor is open is handled by the browser natively. Canvas undo is only active when no text input is focused.
- Undo/redo does NOT broadcast changes to other tabs (BroadcastChannel) in this phase; cross-tab sync will handle convergence when Phase 2 is implemented.
