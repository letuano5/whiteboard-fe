import type { Element } from '../types/shared';
import { useElementsStore } from '../store/elements.store';
import { useInteractionStore } from '../store/interaction.store';
import { dispatchMutationEvent } from '../store/mutation-pipeline';

let _isApplyingRemote = false;

export function isApplyingRemote(): boolean {
  return _isApplyingRemote;
}

// Legacy whole-element LWW merge helper. It remains authoritative only for local
// board/cross-tab sync and pre-P5 network compatibility until P5-11 replaces
// saved-room reconciliation with slot-aware server truth.
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
      const wins =
        el.version > current.version ||
        (el.version === current.version && el.versionNonce < current.versionNonce);
      if (wins) {
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
