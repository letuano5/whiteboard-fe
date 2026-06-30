import { deleteElements } from '../../store/mutation-pipeline';
import { useInteractionStore } from '../../store/interaction.store';
import { onCopySelected, onDuplicateSelected, onPasteSelected } from '../tools/select/clipboard';
import {
  type KeyboardShortcutInput,
  isCopyShortcut,
  isDeleteShortcut,
  isDuplicateShortcut,
  isModifierPressed,
  isPasteShortcut,
} from './shortcut-matchers';

interface KeyboardShortcutEvent extends KeyboardShortcutInput {
  preventDefault?: () => void;
}

export function handleDeleteSelectedShortcut(event: KeyboardShortcutInput): boolean {
  if (!isDeleteShortcut(event)) return false;

  const { selectedIds, setSelectedIds } = useInteractionStore.getState();
  if (selectedIds.length === 0) return false;

  deleteElements(selectedIds);
  setSelectedIds([]);
  return true;
}

export function handleDuplicateSelectedShortcut(event: KeyboardShortcutEvent): boolean {
  if (!isDuplicateShortcut(event)) return false;

  event.preventDefault?.();
  onDuplicateSelected();
  return true;
}

export function handleCopySelectedShortcut(event: KeyboardShortcutEvent): boolean {
  if (!isCopyShortcut(event)) return false;

  event.preventDefault?.();
  onCopySelected();
  return true;
}

export function handlePasteSelectedShortcut(event: KeyboardShortcutEvent): boolean {
  if (!isPasteShortcut(event)) return false;

  event.preventDefault?.();
  onPasteSelected();
  return true;
}

export function handleSelectKeyboardShortcut(event: KeyboardShortcutEvent): boolean {
  if (handleDeleteSelectedShortcut(event)) return true;
  if (!isModifierPressed(event)) return false;
  return (
    handleDuplicateSelectedShortcut(event) ||
    handleCopySelectedShortcut(event) ||
    handlePasteSelectedShortcut(event)
  );
}

export function handleSelectKey(key: string, ctrlOrMeta = false): boolean {
  return handleSelectKeyboardShortcut({ key, ctrlKey: ctrlOrMeta, metaKey: ctrlOrMeta });
}
