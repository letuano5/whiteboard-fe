import { deleteElements } from '../../store/mutation-pipeline';
import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import { onCopySelected, onDuplicateSelected, onPasteSelected } from '../tools/select/clipboard';
import { resolveGroupDeletionIds } from '../tools/select/group';
import { onMergeSelected, onUnmergeSelected } from '../tools/select/merge';
import {
  type KeyboardShortcutInput,
  isCopyShortcut,
  isDeleteShortcut,
  isDuplicateShortcut,
  isMergeShortcut,
  isModifierPressed,
  isPasteShortcut,
  isUnmergeShortcut,
} from './shortcut-matchers';

interface KeyboardShortcutEvent extends KeyboardShortcutInput {
  preventDefault?: () => void;
}

export function handleDeleteSelectedShortcut(event: KeyboardShortcutInput): boolean {
  if (!isDeleteShortcut(event)) return false;

  const { selectedIds, setSelectedIds } = useInteractionStore.getState();
  if (selectedIds.length === 0) return false;

  const elements = useElementsStore.getState().elements;
  deleteElements(resolveGroupDeletionIds(selectedIds, elements));
  setSelectedIds([]);
  return true;
}

export function handleMergeSelectedShortcut(event: KeyboardShortcutEvent): boolean {
  if (!isMergeShortcut(event)) return false;

  event.preventDefault?.();
  onMergeSelected();
  return true;
}

export function handleUnmergeSelectedShortcut(event: KeyboardShortcutEvent): boolean {
  if (!isUnmergeShortcut(event)) return false;

  event.preventDefault?.();
  onUnmergeSelected();
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
    handleUnmergeSelectedShortcut(event) ||
    handleMergeSelectedShortcut(event) ||
    handleDuplicateSelectedShortcut(event) ||
    handleCopySelectedShortcut(event) ||
    handlePasteSelectedShortcut(event)
  );
}

export function handleSelectKey(key: string, ctrlOrMeta = false): boolean {
  return handleSelectKeyboardShortcut({ key, ctrlKey: ctrlOrMeta, metaKey: ctrlOrMeta });
}
