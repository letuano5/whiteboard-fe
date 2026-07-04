import { useHistoryStore } from '../../store';
import { isRedoShortcut, isUndoShortcut } from './shortcut-matchers';

export function handleUndoShortcut(event: KeyboardEvent): boolean {
  if (!isUndoShortcut(event)) return false;
  event.preventDefault();
  useHistoryStore.getState().undo();
  return true;
}

export function handleRedoShortcut(event: KeyboardEvent): boolean {
  if (!isRedoShortcut(event)) return false;
  event.preventDefault();
  useHistoryStore.getState().redo();
  return true;
}

export function handleHistoryKeyboardShortcut(event: KeyboardEvent): boolean {
  return handleUndoShortcut(event) || handleRedoShortcut(event);
}
