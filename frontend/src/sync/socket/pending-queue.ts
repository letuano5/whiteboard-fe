import type { Element } from '../../types/shared';
import { WS_EVENTS } from '../../types/shared';
import { getSocketState } from './state';

export function queuePendingElements(elements: Element[]): void {
  const state = getSocketState();
  state.pendingQueue = [...state.pendingQueue, ...elements];
}

export function clearPendingQueue(): void {
  getSocketState().pendingQueue = [];
}

export function replayPendingQueue(): void {
  const state = getSocketState();
  if (state.pendingQueue.length === 0 || !state.socket || !state.roomId) return;

  state.socket.emit(WS_EVENTS.ELEMENT_UPDATE, {
    roomId: state.roomId,
    elements: state.pendingQueue,
  });
  state.pendingQueue = [];
}
