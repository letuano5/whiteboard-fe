import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';

export function onSelectAll(): void {
  const elements = useElementsStore.getState().elements;
  const ids = elements.filter((el) => !el.isDeleted).map((el) => el.id);
  useInteractionStore.getState().setSelectedIds(ids);
}
