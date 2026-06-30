import { deleteElements } from '../../../store/mutation-pipeline';
import { useInteractionStore } from '../../../store/interaction.store';
import { onCopySelected, onDuplicateSelected, onPasteSelected } from './clipboard';

export function onSelectKeyDown(key: string, ctrlOrMeta = false): void {
  const { selectedIds, setSelectedIds } = useInteractionStore.getState();
  if ((key === 'Delete' || key === 'Backspace') && selectedIds.length > 0) {
    deleteElements(selectedIds);
    setSelectedIds([]);
    return;
  }
  if (ctrlOrMeta) {
    if (key === 'd') {
      onDuplicateSelected();
    } else if (key === 'c') {
      onCopySelected();
    } else if (key === 'v') {
      onPasteSelected();
    }
  }
}
