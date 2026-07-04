import { useEffect } from 'react';
import type { ToolId } from '../../types/interaction';
import { isEditableKeyboardTarget } from '../keyboard-target';
import { handleHistoryKeyboardShortcut } from '../shortcuts/history-shortcuts';
import { handleSelectKeyboardShortcut } from '../shortcuts/select-shortcuts';

export function useWhiteboardShortcuts(tool: ToolId, canEdit = true) {
  useEffect(() => {
    if (!canEdit) return;
    if (tool !== 'select') return;

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableKeyboardTarget(event.target)) return;
      handleSelectKeyboardShortcut(event);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canEdit, tool]);

  useEffect(() => {
    if (!canEdit) return;

    function handleUndoRedo(event: KeyboardEvent) {
      if (isEditableKeyboardTarget(event.target)) return;
      handleHistoryKeyboardShortcut(event);
    }

    window.addEventListener('keydown', handleUndoRedo);
    return () => window.removeEventListener('keydown', handleUndoRedo);
  }, [canEdit]);
}
