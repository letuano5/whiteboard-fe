import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import { deleteElements } from '../../../store/mutation-pipeline';
import { resolveGroupDeletionIds } from './group';

export function onDeleteSelected(): void {
  const { selectedIds, setSelectedIds } = useInteractionStore.getState();
  if (selectedIds.length === 0) return;
  const elements = useElementsStore.getState().elements;
  deleteElements(resolveGroupDeletionIds(selectedIds, elements));
  setSelectedIds([]);
}
