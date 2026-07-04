# Acceptance Criteria Registry: Remote Selection Highlight & Draft Preview (P2.5-04)

> **IMMUTABLE** — AC IDs are frozen. Append-only.

| AC-ID | User Story | Criterion |
|-------|-----------|-----------|
| AC-1 | US1 | Given user A and user B are in the same room, When user A selects a single element, Then user B sees a solid colored border around that element using user A's color. |
| AC-2 | US1 | Given user A has multiple elements selected, When user B observes the canvas, Then user B sees the colored highlight border around all of user A's selected elements. |
| AC-3 | US1 | Given two remote users each have different elements selected simultaneously, When user C observes, Then user C sees each user's selections highlighted in their respective colors at the same time. |
| AC-4 | US1 | Given user A deselects all elements (clicks on empty canvas), When user B observes, Then the colored highlight from user A disappears from user B's view. |
| AC-5 | US1 | Given user A leaves the room, When user B observes the canvas, Then all highlights from user A disappear. |
| AC-6 | US2 | Given user A begins dragging an element, When user B observes, Then user B sees the element move in real time as a draft ghost with a visual indicator (opacity, border) distinguishing it from committed state. |
| AC-7 | US2 | Given user A is resizing an element, When user B observes, Then user B sees the element resize in real time as a draft preview. |
| AC-8 | US2 | Given user A is creating a new element by drawing (drag to create), When user B observes, Then user B sees the in-progress shape appear as a ghost element before user A releases. |
| AC-9 | US2 | Given user A cancels a drag (presses Escape), When user B observes, Then the ghost/draft preview disappears and the element returns to its last committed position. |
| AC-10 | US2 | Given user A commits the change (releases pointer), When the commit lands on user B, Then the ghost preview is replaced by the committed element with full opacity. |
| AC-11 | US2 | Given user A and user B both have the same element selected, When user A drags or resizes that element and user B receives remote drafts, Then user B's local selection bbox follows the draft geometry instead of the stale committed geometry. |
| AC-12 | US1/US2 | Given a selected or drafted element has a non-zero `angle`, When another user observes its remote selection/draft bbox, Then the bbox is rotated by the same angle around the element bbox center. |
