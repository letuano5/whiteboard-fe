import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import type { Point } from '../../../types/geometry';

// AC-1: initiate rotate drag on the selected element
export function onRotateHandlePointerDown(worldPt: Point): void {
  const { selectedIds, setDraggingId, setDragStart, setIsRotating } =
    useInteractionStore.getState();
  if (selectedIds.length === 0) return;
  const el = useElementsStore
    .getState()
    .elements.find((e) => e.id === selectedIds[0] && !e.isDeleted);
  if (!el) return;
  setDraggingId(el.id);
  setDragStart(worldPt);
  setIsRotating(true);
}
