import { registerMutationHook } from '../store/mutation-pipeline';
import { useHistoryStore } from '../store/history.store';

export function initHistoryCapture(): () => void {
  return registerMutationHook((event) => {
    if (useHistoryStore.getState().isApplying) return;
    useHistoryStore.getState().push({ before: event.before, after: event.elements });
  });
}
