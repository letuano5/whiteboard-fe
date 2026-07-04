import { updateElements } from '../../../store/mutation-pipeline';
import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import type { Element } from '../../../types/shared';

function selectableElements(elements: Element[], selectedIds: string[]): Element[] {
  return elements.filter((el) => selectedIds.includes(el.id) && !el.isDeleted);
}

export function canToggleLockSelection(elements: Element[], selectedIds: string[]): boolean {
  return selectableElements(elements, selectedIds).length > 0;
}

/** True when every selected element is locked — the next toggle action will unlock. */
export function isSelectionLocked(elements: Element[], selectedIds: string[]): boolean {
  const selected = selectableElements(elements, selectedIds);
  return selected.length > 0 && selected.every((el) => el.locked);
}

export function onToggleLockSelected(): void {
  const { selectedIds } = useInteractionStore.getState();
  const elements = useElementsStore.getState().elements;
  const selected = selectableElements(elements, selectedIds);
  if (selected.length === 0) return;

  const nextLocked = !selected.every((el) => el.locked);
  updateElements(selected.map((el) => ({ id: el.id, patch: { locked: nextLocked } })));
}
