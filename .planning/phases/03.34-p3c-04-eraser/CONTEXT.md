# Context: P3C-04 Eraser

## Source Scope

Canonical scope comes from `docs/SPECS.md` `[P3C-04]`.

- Dragging the eraser through a shape deletes the shape by setting `isDeleted = true`.
- Deletes must sync through the existing mutation pipeline.
- Hit-testing uses a line-segment sweep between consecutive pointer samples and reuses the existing
  shape hit-test utilities from the select-tool path.
- The MVP deletes whole shapes only; it does not cut ink strokes into segments.

## Locked Decisions

- Eraser is a frontend tool in the existing SVG pointer pipeline.
- Eraser does not introduce a Canvas renderer or a second hit-test registry.
- The delete operation uses `deleteElements` from `frontend/src/store/mutation-pipeline.ts`.
- Visible elements only are candidates; already-deleted elements are not erased again.
- The toolbar exposes the eraser as an editing tool alongside existing drawing tools.

## Non-goals

- Partial stroke erasing.
- Pixel-level blend/composite erasing.
- New backend protocols beyond the existing mutation hooks.
