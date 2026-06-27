import { registerMutationHook } from '../store/mutation-pipeline';
import { useHistoryStore } from '../store/history.store';
import { isApplyingRemote } from './apply-remote';

export function initHistoryCapture(): () => void {
  return registerMutationHook((event) => {
    if (useHistoryStore.getState().isApplying) return;
    if (isApplyingRemote()) return;
    useHistoryStore.getState().push({ before: event.before, after: event.elements });
  });
}
