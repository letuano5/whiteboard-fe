import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import type { Point } from '../../../types/geometry';
import type { HandleId, ResizeHandleId } from '../../../types/interaction';
import type { Element } from '../../../types/shared';
import { getMultiSelectBounds } from '../../layers/svg/selectors';
import { hitTestElementAtWorldPoint } from '../../shapes/hit-test';
import { isFullyBoundArrow } from './bound-arrows';
import { normalizeRect } from './geometry';
import { resolveGroupMembers, resolveSelectionGroupIds } from './group';
import { getResizeAnchor, isCornerResizeHandle, resizeBoundsFromAnchorAndPointer } from './resize';

export function onSelectPointerDown(
  worldPt: Point,
  shiftKey = false,
  toggleModifierKey = false,
): void {
  const toggleKey = shiftKey || toggleModifierKey;
  const elements = useElementsStore.getState().elements;
  const visible = elements.filter((el) => !el.isDeleted).sort((a, b) => b.zIndex - a.zIndex);
  const {
    selectedIds,
    setSelectedIds,
    setDraggingId,
    setDragStart,
    setResizeHandle,
    setResizeSession,
    setGroupResizeSession,
    setMarquee,
  } = useInteractionStore.getState();

  for (const el of visible) {
    if (hitTestElementAtWorldPoint(el, worldPt)) {
      setMarquee(null);
      if (toggleKey) {
        // @covers AC-4, AC-5, AC-6: shift-click/ctrl-click/cmd-click toggles element in/out of selection
        const alreadySelected = selectedIds.includes(el.id);
        const newIds = alreadySelected
          ? selectedIds.filter((id) => id !== el.id)
          : [...selectedIds, el.id];
        setSelectedIds(newIds);
        setDraggingId(null);
        setDragStart(null);
      } else if (selectedIds.includes(el.id)) {
        // Already selected: keep multi-selection, start drag (unless arrow is fully bound)
        if (!isFullyBoundArrow(el)) {
          setDraggingId(el.id);
          setDragStart(worldPt);
          setResizeHandle(null);
          setResizeSession(null);
          setGroupResizeSession(null);
        }
      } else {
        // Replace selection with this element
        const groupMembers = el.groupId ? resolveGroupMembers(el.groupId, elements) : [];
        setSelectedIds(groupMembers.length > 1 ? groupMembers.map((member) => member.id) : [el.id]);
        if (!isFullyBoundArrow(el)) {
          setDraggingId(el.id);
          setDragStart(worldPt);
          setResizeHandle(null);
          setResizeSession(null);
          setGroupResizeSession(null);
        }
      }
      return;
    }
  }

  // Miss: start marquee drag; @covers AC-3, AC-7
  if (!toggleKey) setSelectedIds([]);
  setDraggingId(null);
  setDragStart(worldPt);
  setResizeHandle(null);
  setResizeSession(null);
  setGroupResizeSession(null);
  setMarquee(normalizeRect(worldPt, worldPt));
}

export function onSelectHandlePointerDown(handle: HandleId, worldPt: Point): void {
  const {
    selectedIds,
    setDraggingId,
    setDragStart,
    setResizeHandle,
    setResizeSession,
    setGroupResizeSession,
  } = useInteractionStore.getState();
  if (selectedIds.length === 0) return;
  const elements = useElementsStore.getState().elements;
  const groupMemberIds = resolveSelectionGroupIds(selectedIds, elements);
  const selected = elements.find((el) => el.id === selectedIds[0] && !el.isDeleted);
  if (!selected) return;

  // Endpoint handles: just start a drag without creating a resize session
  if (handle === 'ep-start' || handle === 'ep-end') {
    setDraggingId(selected.id);
    setDragStart(worldPt);
    setResizeHandle(handle);
    setResizeSession(null);
    setGroupResizeSession(null);
    return;
  }

  // At this point handle is ResizeHandleId | 'rotate'; 'rotate' is handled by
  // Whiteboard.tsx before calling this function, so it is always a ResizeHandleId here.
  const resizeHandle = handle as ResizeHandleId;
  if (groupMemberIds) {
    const bounds = getMultiSelectBounds(elements, groupMemberIds);
    if (!bounds) return;
    setDraggingId(selected.id);
    setDragStart(worldPt);
    setResizeHandle(resizeHandle);
    setResizeSession(null);
    setGroupResizeSession({
      originalBounds: bounds,
      originalHandle: resizeHandle,
      anchor: getResizeAnchor({ ...selected, ...bounds }, resizeHandle),
      memberIds: groupMemberIds,
    });
    return;
  }

  if (selected.type === 'image' && !isCornerResizeHandle(resizeHandle)) return;

  setDraggingId(selected.id);
  setDragStart(worldPt);
  setResizeHandle(resizeHandle);
  setGroupResizeSession(null);
  setResizeSession({
    originalBounds: {
      x: selected.x,
      y: selected.y,
      width: selected.width,
      height: selected.height,
    },
    originalHandle: resizeHandle,
    anchor: getResizeAnchor(selected, resizeHandle),
  });
}

export function computeResize(
  el: Element,
  handle: ResizeHandleId,
  worldPt: Point,
): ReturnType<typeof resizeBoundsFromAnchorAndPointer> {
  return resizeBoundsFromAnchorAndPointer(
    {
      originalBounds: { x: el.x, y: el.y, width: el.width, height: el.height },
      originalHandle: handle,
      anchor: getResizeAnchor(el, handle),
    },
    worldPt,
  );
}
