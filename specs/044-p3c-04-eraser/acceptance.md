# Acceptance Criteria

AC-1: The eraser tool must soft-delete visible shapes by setting `isDeleted = true` when the user
drags through them.

AC-2: Eraser deletes must go through the existing element mutation pipeline so deletion events are
emitted for realtime sync and persistence hooks.

AC-3: Eraser hit-testing must use a line-segment sweep between consecutive pointer samples and reuse
the registered shape hit-test utilities used by the select tool, rather than a separate eraser-only
geometry system.

AC-4: Eraser deletes whole shapes only; when it hits a freehand or highlighter stroke, the entire
element is deleted and the stroke is not split into smaller segments.

AC-5: An eraser delete must be undoable through the existing undo history; triggering undo after
erasing a shape restores that whole shape locally.
