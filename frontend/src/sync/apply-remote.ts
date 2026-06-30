import { doesIncomingElementWin, type Element } from '../types/shared';
import { useElementsStore } from '../store/elements.store';
import { useInteractionStore } from '../store/interaction.store';
import { dispatchMutationEvent } from '../store/mutation-pipeline';

let _isApplyingRemote = false;

export function isApplyingRemote(): boolean {
  return _isApplyingRemote;
}

export function applyRemoteElements(incoming: Element[]): void {
  if (incoming.length === 0) return;

  const { elements } = useElementsStore.getState();
  const { draggingId, selectedIds, resizeSession, isRotating, editingId } =
    useInteractionStore.getState();

  const activeIds = new Set<string>();
  if (draggingId) activeIds.add(draggingId);
  if ((resizeSession !== null || isRotating) && selectedIds.length > 0) {
    selectedIds.forEach((id) => activeIds.add(id));
  }
  if (editingId) activeIds.add(editingId);

  const storeMap = new Map(elements.map((e) => [e.id, e]));
  const toApply: Element[] = [];
  const before: Element[] = [];

  for (const el of incoming) {
    if (activeIds.has(el.id)) continue;

    const current = storeMap.get(el.id);
    if (!current) {
      toApply.push(el);
    } else {
      if (doesIncomingElementWin(el, current)) {
        toApply.push(el);
        before.push(current);
      }
    }
  }

  if (toApply.length === 0) return;

  const applyMap = new Map(toApply.map((e) => [e.id, e]));
  const newElements = [
    ...elements.map((e) => applyMap.get(e.id) ?? e),
    ...toApply.filter((e) => !storeMap.has(e.id)),
  ];

  _isApplyingRemote = true;
  try {
    useElementsStore.getState().setElements(newElements);
    dispatchMutationEvent({ type: 'update', elements: toApply, before });
  } finally {
    _isApplyingRemote = false;
  }
}
