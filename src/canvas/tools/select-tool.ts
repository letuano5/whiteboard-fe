import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import { patchElement, deleteElements } from '../../store/mutation-pipeline';
import { getShapeUtil } from '../shapes';
import type { Point } from '../../types/geometry';
import type { HandleId } from '../../types/interaction';
import type { Element } from '../../types/shared';

export function onSelectPointerDown(worldPt: Point): void {
  const elements = useElementsStore.getState().elements;
  const visible = elements.filter((el) => !el.isDeleted).sort((a, b) => b.zIndex - a.zIndex);
  const { setSelectedIds, setDraggingId, setDragStart, setResizeHandle } =
    useInteractionStore.getState();

  for (const el of visible) {
    const util = getShapeUtil(el.type);
    if (util && util.hitTest(el, worldPt.x, worldPt.y)) {
      setSelectedIds([el.id]);
      setDraggingId(el.id);
      setDragStart(worldPt);
      setResizeHandle(null);
      return;
    }
  }
  setSelectedIds([]);
  setDraggingId(null);
  setDragStart(null);
  setResizeHandle(null);
}

export function onSelectHandlePointerDown(handle: HandleId, worldPt: Point): void {
  const { selectedIds, setDraggingId, setDragStart, setResizeHandle } =
    useInteractionStore.getState();
  if (selectedIds.length === 0) return;
  setDraggingId(selectedIds[0]);
  setDragStart(worldPt);
  setResizeHandle(handle);
}

export function computeResize(
  el: Element,
  handle: HandleId,
  worldPt: Point,
): { x: number; y: number; width: number; height: number } {
  const { x, y, width: w, height: h } = el;
  const MIN = 1;

  // anchor is the corner/edge opposite the dragged handle
  const anchorX = handle === 'nw' || handle === 'sw' || handle === 'w' ? x + w : x;
  const anchorY = handle === 'nw' || handle === 'ne' || handle === 'n' ? y + h : y;

  let newX = x;
  let newY = y;
  let newW = w;
  let newH = h;

  if (handle === 'nw' || handle === 'sw' || handle === 'w') {
    newW = Math.max(MIN, anchorX - worldPt.x);
    newX = anchorX - newW;
  } else if (handle === 'ne' || handle === 'se' || handle === 'e') {
    newW = Math.max(MIN, worldPt.x - anchorX);
    newX = anchorX;
  }

  if (handle === 'nw' || handle === 'ne' || handle === 'n') {
    newH = Math.max(MIN, anchorY - worldPt.y);
    newY = anchorY - newH;
  } else if (handle === 'sw' || handle === 'se' || handle === 's') {
    newH = Math.max(MIN, worldPt.y - anchorY);
    newY = anchorY;
  }

  return { x: newX, y: newY, width: newW, height: newH };
}

export function onSelectPointerMove(worldPt: Point): void {
  const { draggingId, dragStart, resizeHandle, setDraftElement } =
    useInteractionStore.getState();
  if (!draggingId || !dragStart) return;

  const elements = useElementsStore.getState().elements;
  const el = elements.find((e) => e.id === draggingId);
  if (!el) return;

  if (resizeHandle) {
    const { x, y, width, height } = computeResize(el, resizeHandle, worldPt);
    setDraftElement({ ...el, x, y, width, height });
  } else {
    const dx = worldPt.x - dragStart.x;
    const dy = worldPt.y - dragStart.y;
    setDraftElement({ ...el, x: el.x + dx, y: el.y + dy });
  }
}

export function onSelectPointerUp(_worldPt: Point): void {
  const {
    draggingId,
    dragStart,
    draftElement,
    resizeHandle,
    setDraggingId,
    setDragStart,
    setResizeHandle,
    setDraftElement,
  } = useInteractionStore.getState();

  if (draggingId && dragStart && draftElement) {
    if (resizeHandle) {
      patchElement(draggingId, {
        x: draftElement.x,
        y: draftElement.y,
        width: draftElement.width,
        height: draftElement.height,
      });
    } else {
      patchElement(draggingId, { x: draftElement.x, y: draftElement.y });
    }
  }

  setDraggingId(null);
  setDragStart(null);
  setResizeHandle(null);
  setDraftElement(null);
}

export function onSelectKeyDown(key: string): void {
  const { selectedIds, setSelectedIds } = useInteractionStore.getState();
  if ((key === 'Delete' || key === 'Backspace') && selectedIds.length > 0) {
    deleteElements(selectedIds);
    setSelectedIds([]);
  }
}
