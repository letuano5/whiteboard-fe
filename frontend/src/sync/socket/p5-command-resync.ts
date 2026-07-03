import type { SyncCommand } from '../../types/shared';
import { WS_EVENTS } from '../../types/shared';
import { useElementsStore } from '../../store/elements.store';
import {
  getKnownSlotClock,
  getPendingRequestRefs,
  getSocketState,
  isKnownTombstone,
} from './state';

export function requestBackpressureResync(): void {
  const state = getSocketState();
  if (!state.socket || !state.roomId) return;
  state.socket.emit(WS_EVENTS.ROOM_DIFF_REQUEST, {
    roomId: state.roomId,
    lastServerClock: state.lastServerClock,
    roomEpoch: state.roomEpoch,
    pendingRequests: getPendingRequestRefs(),
    fromClock: state.lastServerClock,
  });
}

export function isCommandRelevantForResend(command: SyncCommand): boolean {
  const state = getSocketState();
  if (command.baseRoomEpoch !== state.roomEpoch) return false;

  const serverElements = state.hasServerState
    ? state.serverElements
    : useElementsStore.getState().elements;
  const serverById = new Map(serverElements.map((element) => [element.id, element]));
  switch (command.kind) {
    case 'create-element':
      return !serverById.has(command.element.id);
    case 'patch-slots':
      return command.patches.every(
        (patch) =>
          serverById.has(patch.elementId) &&
          getKnownSlotClock(patch.elementId, patch.slot) === patch.baseClock,
      );
    case 'delete-elements':
      return command.elementIds.every((elementId) => serverById.has(elementId));
    case 'restore-elements':
      return command.elements.every(
        (element) => !serverById.has(element.id) && isKnownTombstone(element.id),
      );
    case 'reorder-elements':
      return command.moves.every(
        (move) =>
          serverById.has(move.elementId) &&
          (move.afterElementId === undefined || serverById.has(move.afterElementId)) &&
          (move.beforeElementId === undefined || serverById.has(move.beforeElementId)) &&
          (move.baseOrderClock === undefined ||
            getKnownSlotClock(move.elementId, 'order') === move.baseOrderClock),
      );
    case 'update-arrow-binding':
      return (
        serverById.has(command.arrowId) &&
        getKnownSlotClock(
          command.arrowId,
          command.terminal === 'start' ? 'binding.start' : 'binding.end',
        ) === command.baseBindingClock &&
        Math.max(
          getKnownSlotClock(command.arrowId, 'geometry.startPoint'),
          getKnownSlotClock(command.arrowId, 'geometry.endPoint'),
        ) === command.baseGeometryClock
      );
    case 'replace-document':
      return true;
  }
}
