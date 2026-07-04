# Acceptance Criteria

AC-1: With 2+ elements selected, a Merge/Group command (context menu item, enabled during
multi-select, plus Cmd/Ctrl+G) must assign the same `groupId` to every selected element.

AC-2: With an element that already belongs to a group selected, an Unmerge/Ungroup command
(context menu item plus Cmd/Ctrl+Shift+G) must clear `groupId` on every element in that group.

AC-3: Merging a selection that mixes elements already in group `G` with ungrouped elements must
assign `groupId = G` to the whole selection (join the existing group, no new id). Merging a
selection that contains elements from 2+ distinct existing groups must flatten all of their
elements into one newly generated `groupId`.

AC-4: Merging exactly one `text` element with exactly one container-eligible shape (`rectangle`,
`ellipse`, `diamond`, `triangle`, `polygon`, or `image`) must bind the text as the container's
label: center the text in the container at merge time, wrap it to the container's available width
with minimum padding, and give it a higher `zIndex` than the container.

AC-5: Merging a `text` element with more than one container-eligible shape, or merging more than
one `text` element into a group, must produce a plain group (shared `groupId` only) — no
center/wrap/recenter/zIndex-binding behavior applies.

AC-6: Moving a bound container must move its bound text by the same delta. Resizing a bound
container must update the bound text's bbox/wrap width so the label stays inside the container
when its content is short enough to fit. Deleting a bound container must also delete its bound
text so no orphaned label remains.

AC-7: A z-order command (Bring to Front / Forward / Backward / Send to Back) applied to a bound
container must move its bound text along with it so the text stays above the container. The same
z-order command applied directly to a bound text element must be a no-op, since its z-position is
always derived from its container.

AC-8: Dragging any single item that belongs to a group must move every element in the group
together in draft state and commit the move as one mutation batch through the existing mutation
pipeline.

AC-9: Resizing a group by its combined bounding box must scale non-text elements to the new bbox,
recenter and rewrap any container-bound text to its (resized) container, and preserve the relative
position of any text that is independent within the group (not bound to a container).

AC-10: Deleting any single item that belongs to a group must delete every element in that group,
unless the group was unmerged first.

AC-11: Copying or duplicating a group must preserve the internal grouping relationship by
assigning a new shared `groupId` to the copies, without reusing the original group's id.

AC-12: Merge, unmerge, group move, group resize, and group delete must each be undoable/redoable
as a single step through the existing undo/redo system.

AC-13: All group and text-binding mutations (P1-P5 above) must be expressed as element property
updates that flow through the existing element update path — no new WebSocket event types are
introduced, and the `groupId` field reuses the `grouping.groupId` slot already defined in the sync
contracts.
