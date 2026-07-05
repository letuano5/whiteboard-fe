import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import { updateElements } from '../../../store/mutation-pipeline';
import type { Element } from '../../../types/shared';
import { computeBoundArrowDrafts, computeMultiDragDrafts } from './bound-arrows';
import { computeBoundContainerCascade, computeGroupDragDrafts } from './group-drag';
import { resolveSelectionGroupIds } from './group';
import { translatePointGeometry } from './point-geometry';

export function onMoveSelected(dx: number, dy: number): void {
  const { selectedIds } = useInteractionStore.getState();
  if (selectedIds.length === 0) return;

  const elements = useElementsStore.getState().elements;
  const groupMemberIds = resolveSelectionGroupIds(selectedIds, elements);

  let drafts: Element[];
  if (groupMemberIds) {
    drafts = computeGroupDragDrafts(groupMemberIds, dx, dy, elements);
  } else if (selectedIds.length > 1) {
    drafts = computeMultiDragDrafts(selectedIds, dx, dy, elements);
  } else {
    const el = elements.find((e) => e.id === selectedIds[0] && !e.isDeleted);
    if (!el) return;
    const draftEl = {
      ...el,
      x: el.x + dx,
      y: el.y + dy,
      props: translatePointGeometry(el, dx, dy),
    };
    drafts = [
      draftEl,
      ...computeBoundArrowDrafts(draftEl, elements),
      ...computeBoundContainerCascade(draftEl, elements),
    ];
  }

  if (drafts.length === 0) return;
  updateElements(drafts.map((el) => ({ id: el.id, patch: { x: el.x, y: el.y, props: el.props } })));
}
