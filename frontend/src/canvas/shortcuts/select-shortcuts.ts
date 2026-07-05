import { useInteractionStore } from '../../store/interaction.store';
import {
  onCopySelected,
  onCutSelected,
  onDuplicateSelected,
  onPasteSelected,
} from '../tools/select/clipboard';
import { onDeleteSelected } from '../tools/select/delete';
import { onMergeSelected, onUnmergeSelected } from '../tools/select/merge';
import { onMoveSelected } from '../tools/select/move';
import { onSelectAll } from '../tools/select/select-all';
import {
  type KeyboardShortcutInput,
  isArrowMoveShortcut,
  isCopyShortcut,
  isCutShortcut,
  isDeleteShortcut,
  isDuplicateShortcut,
  isMergeShortcut,
  isModifierPressed,
  isPasteShortcut,
  isSelectAllShortcut,
  isUnmergeShortcut,
} from './shortcut-matchers';

interface KeyboardShortcutEvent extends KeyboardShortcutInput {
  preventDefault?: () => void;
}

const MOVE_STEP = 1;
const MOVE_STEP_LARGE = 10;
const ARROW_DELTAS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

export function handleDeleteSelectedShortcut(event: KeyboardShortcutInput): boolean {
  if (!isDeleteShortcut(event)) return false;

  const { selectedIds } = useInteractionStore.getState();
  if (selectedIds.length === 0) return false;

  onDeleteSelected();
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

export function handleCutSelectedShortcut(event: KeyboardShortcutEvent): boolean {
  if (!isCutShortcut(event)) return false;

  const { selectedIds } = useInteractionStore.getState();
  if (selectedIds.length === 0) return false;

  event.preventDefault?.();
  onCutSelected();
  return true;
}

export function handleSelectAllShortcut(event: KeyboardShortcutEvent): boolean {
  if (!isSelectAllShortcut(event)) return false;

  event.preventDefault?.();
  onSelectAll();
  return true;
}

export function handleMoveSelectedShortcut(event: KeyboardShortcutEvent): boolean {
  if (!isArrowMoveShortcut(event)) return false;

  const { selectedIds } = useInteractionStore.getState();
  if (selectedIds.length === 0) return false;

  const [ux, uy] = ARROW_DELTAS[event.key];
  const step = event.shiftKey ? MOVE_STEP_LARGE : MOVE_STEP;
  event.preventDefault?.();
  onMoveSelected(ux * step, uy * step);
  return true;
}

export function handleSelectKeyboardShortcut(event: KeyboardShortcutEvent): boolean {
  if (handleDeleteSelectedShortcut(event)) return true;
  if (handleMoveSelectedShortcut(event)) return true;
  if (!isModifierPressed(event)) return false;
  return (
    handleSelectAllShortcut(event) ||
    handleUnmergeSelectedShortcut(event) ||
    handleMergeSelectedShortcut(event) ||
    handleDuplicateSelectedShortcut(event) ||
    handleCopySelectedShortcut(event) ||
    handleCutSelectedShortcut(event) ||
    handlePasteSelectedShortcut(event)
  );
}

export function handleSelectKey(key: string, ctrlOrMeta = false): boolean {
  return handleSelectKeyboardShortcut({ key, ctrlKey: ctrlOrMeta, metaKey: ctrlOrMeta });
}
