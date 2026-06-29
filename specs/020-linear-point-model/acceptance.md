# Acceptance Criteria Registry: Point-Based Model for Linear Elements

> **Frozen** — IDs are append-only and immutable after generation.
> Source: `spec.md` User Stories and Functional Requirements.

## AC Registry

| ID | Source | Criterion |
|----|--------|-----------|
| AC-1 | US1 AC-1, FR-001 | Given an arrow element with `props.points`, when `getBounds` is called on it, then the returned bbox equals the AABB of `props.points` (not stored `x,y,width,height`). |
| AC-2 | US1 AC-2, FR-001 | Given an arrow/line element whose stored `x,y,width,height` diverges from its `props.points`, when `getBounds` is called, then the returned bbox derives exclusively from `props.points`. |
| AC-3 | US2 AC-1, FR-002 | Given a mutation that changes `props.points` of an arrow, when the mutation is committed through `patchElement`, then the stored `x,y,width,height` equal the AABB of the updated `props.points`. |
| AC-4 | US2 AC-2, FR-002 | Given a new arrow created via `createElement`/`createElements`, when the element is written to the store, then its `x,y,width,height` derive from `props.points` via `normalizeLinearBounds`. |
| AC-5 | US3 AC-1, FR-003 | Given an arrow is selected, when the selection overlay renders, then exactly two endpoint handles (circles, `data-handle="ep-start"` and `data-handle="ep-end"`) are shown and no bbox corner/edge handles (`nw`,`ne`, etc.) appear. |
| AC-6 | US3 AC-2, FR-004 | Given the user drags the start endpoint handle, when the pointer is released, then `props.points[0]` is updated to the dropped position and `props.points[1]` is unchanged. |
| AC-7 | US3 AC-3, FR-004 | Given the user drags the end endpoint handle over a shape within the snap threshold, when the pointer is released, then `endBinding` is set and the endpoint snaps to the target's attachment point. |
| AC-8 | US4 AC-1, FR-005 | Given a rectangle has an arrow whose `startBinding` targets it, when the rectangle is being dragged (pointer still held / `onSelectPointerMove`), then the arrow is included in `draftElements` with points already recomputed relative to the draft rectangle position. |
| AC-9 | US4 AC-2, FR-005 | Given the user releases the pointer after dragging a bound shape, when the mutation is committed, then the arrow's final stored `props.points` match its position at pointer-up. |
| AC-10 | US5 AC-1, FR-007 | Given an arrow exists, when the user clicks within the hit-test region (within 8px of the shaft), then the arrow is selected (geometric test unchanged). |
| AC-11 | US5 AC-2, FR-008 | Given an arrow endpoint was moved, when the user triggers undo, then `props.points` returns to its pre-move values and the arrow redraws correctly. |
