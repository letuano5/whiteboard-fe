import { registerMutationHook } from '../store/mutation-pipeline';
import { useHistoryStore } from '../store/history.store';
import { isApplyingRemote } from './apply-remote';
import { diffElementSlots } from './socket/p5-command-materializer';
import { getKnownSlotClock } from './socket/state';

export function initHistoryCapture(): () => void {
  return registerMutationHook((event) => {
    if (useHistoryStore.getState().isApplying) return;
    if (isApplyingRemote()) return;
    useHistoryStore.getState().push({
      before: event.before,
      after: event.elements,
      readPreconditions: event.before.flatMap((before, index) => {
        const after =
          event.elements[index] ?? event.elements.find((element) => element.id === before.id);
        if (!after) return [];
        return diffElementSlots(before, after).map((patch) => ({
          elementId: patch.elementId,
          slot: patch.slot,
          baseClock: getKnownSlotClock(patch.elementId, patch.slot),
          onStale: 'reject' as const,
        }));
      }),
    });
  });
}
