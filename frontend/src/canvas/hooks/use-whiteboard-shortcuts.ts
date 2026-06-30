import { useEffect } from 'react';
import { useHistoryStore } from '../../store';
import type { ToolId } from '../../types/interaction';
import { onSelectKeyDown } from '../tools/select-tool';
import { isEditableKeyboardTarget } from '../keyboard-target';

export function useWhiteboardShortcuts(tool: ToolId) {
  useEffect(() => {
    if (tool !== 'select') return;

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableKeyboardTarget(event.target)) return;

      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      if (ctrlOrMeta && (event.key === 'd' || event.key === 'c' || event.key === 'v')) {
        event.preventDefault();
      }
      onSelectKeyDown(event.key, ctrlOrMeta);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tool]);

  useEffect(() => {
    function handleUndoRedo(event: KeyboardEvent) {
      if (isEditableKeyboardTarget(event.target)) return;

      const isMod = event.ctrlKey || event.metaKey;
      if (!isMod) return;

      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        useHistoryStore.getState().undo();
      } else if (event.key === 'z' && event.shiftKey) {
        event.preventDefault();
        useHistoryStore.getState().redo();
      }
    }

    window.addEventListener('keydown', handleUndoRedo);
    return () => window.removeEventListener('keydown', handleUndoRedo);
  }, []);
}
