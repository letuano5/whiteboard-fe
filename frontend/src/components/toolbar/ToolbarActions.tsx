import { Undo2, Redo2, CopyPlus, Trash2 } from 'lucide-react';
import { useHistoryStore } from '../../store/history.store';
import { useInteractionStore } from '../../store/interaction.store';
import { onDuplicateSelected } from '../../canvas/tools/select/clipboard';
import { onDeleteSelected } from '../../canvas/tools/select/delete';
import ActionButton from './ActionButton';

export default function ToolbarActions() {
  const canUndo = useHistoryStore((s) => s.undoStack.length > 0);
  const canRedo = useHistoryStore((s) => s.redoStack.length > 0);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const hasSelection = useInteractionStore((s) => s.selectedIds.length > 0);

  return (
    <>
      <ActionButton title="Undo" disabled={!canUndo} onClick={undo} Icon={Undo2} />
      <ActionButton title="Redo" disabled={!canRedo} onClick={redo} Icon={Redo2} />
      <ActionButton
        title="Duplicate"
        disabled={!hasSelection}
        onClick={onDuplicateSelected}
        Icon={CopyPlus}
      />
      <ActionButton
        title="Delete"
        disabled={!hasSelection}
        onClick={onDeleteSelected}
        Icon={Trash2}
      />
    </>
  );
}
