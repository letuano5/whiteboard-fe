import { create } from 'zustand';
import type { Element } from '../types/shared';
import { deleteElements, applySnapshot } from './mutation-pipeline';

export interface HistoryEntry {
  before: Element[];
  after: Element[];
}

const MAX_HISTORY = 100;

interface HistoryState {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  isApplying: boolean;
}

interface HistoryActions {
  push: (entry: HistoryEntry) => void;
  undo: () => void;
  redo: () => void;
}

// TODO: Consider the complexity of redo/undo operations.

export const useHistoryStore = create<HistoryState & HistoryActions>()((set, get) => ({
  undoStack: [],
  redoStack: [],
  isApplying: false,

  push(entry) {
    set((state) => {
      const next = [...state.undoStack, entry];
      return {
        undoStack: next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next,
        redoStack: [],
      };
    });
  },

  undo() {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) return;

    const entry = undoStack[undoStack.length - 1];
    set({ isApplying: true, undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, entry] });

    if (entry.before.length === 0) {
      // Undo of createElement: soft-delete the created elements
      deleteElements(entry.after.map((e) => e.id));
    } else {
      applySnapshot(entry.before);
    }

    set({ isApplying: false });
  },

  redo() {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) return;

    const entry = redoStack[redoStack.length - 1];
    set({ isApplying: true, redoStack: redoStack.slice(0, -1), undoStack: [...undoStack, entry] });

    applySnapshot(entry.after);

    set({ isApplying: false });
  },
}));
