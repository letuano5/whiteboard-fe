import { create } from 'zustand';
import type { Element } from '../types/shared';

interface ElementsState {
  elements: Element[];
}

interface ElementsActions {
  setElements: (elements: Element[]) => void;
  addElement: (element: Element) => void;
  updateElement: (updated: Element) => void;
  updateElements: (updated: Element[]) => void;
  removeElements: (ids: string[]) => void;
}

export const useElementsStore = create<ElementsState & ElementsActions>()((set) => ({
  elements: [],

  setElements: (elements) => set({ elements }),

  addElement: (element) => set((state) => ({ elements: [...state.elements, element] })),

  updateElement: (updated) =>
    set((state) => ({
      elements: state.elements.map((el) => (el.id === updated.id ? updated : el)),
    })),

  updateElements: (updated) => {
    const updatedMap = new Map(updated.map((el) => [el.id, el]));
    set((state) => ({
      elements: state.elements.map((el) => updatedMap.get(el.id) ?? el),
    }));
  },

  removeElements: (ids) => {
    const idSet = new Set(ids);
    set((state) => ({
      elements: state.elements.filter((el) => !idSet.has(el.id)),
    }));
  },
}));
