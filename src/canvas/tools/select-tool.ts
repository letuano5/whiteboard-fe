import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import { getShapeUtil } from '../shapes';
import type { Point } from '../../types/geometry';

export function onSelectPointerDown(worldPt: Point): void {
  const elements = useElementsStore.getState().elements;
  const visible = elements.filter((el) => !el.isDeleted).sort((a, b) => b.zIndex - a.zIndex);

  for (const el of visible) {
    const util = getShapeUtil(el.type);
    if (util && util.hitTest(el, worldPt.x, worldPt.y)) {
      useInteractionStore.getState().setSelectedIds([el.id]);
      return;
    }
  }
  useInteractionStore.getState().setSelectedIds([]);
}
