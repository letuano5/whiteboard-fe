import type { CommittedChangeSet, SyncAck, SyncBroadcast, SyncClock } from '../../types/shared';
import { WS_EVENTS } from '../../types/shared';
import { useElementsStore } from '../../store/elements.store';
import { applyChangeSetToElements } from './p5-change-set';
import { getSocketState, setLastServerClock, type PendingSyncRequest } from './state';

export type P5ReconciliationResult =
  | { status: 'applied'; serverClock: SyncClock }
  | { status: 'ignored-stale'; serverClock: SyncClock }
  | { status: 'gap'; serverClock: SyncClock };

interface ReconciliationOptions {
  localActorId?: string | null;
  requestRoomDiff?: (roomId: string, lastServerClock: SyncClock, incomingClock: SyncClock) => void;
}

export function queuePendingSyncRequest(request: PendingSyncRequest): void {
  const state = getSocketState();
  state.pendingSyncRequests = [...state.pendingSyncRequests, request];
}

export function processSyncAck(
  ack: SyncAck,
  options: ReconciliationOptions = {},
): P5ReconciliationResult {
  clearPendingRequest(ack.requestId);

  if (ack.status === 'reject') {
    if (ack.serverChangeSet) {
      return applyIncomingChangeSet(ack.serverChangeSet, options);
    }
    return { status: 'applied', serverClock: ack.serverClock };
  }

  return applyIncomingChangeSet(ack.changeSet, options);
}

export function processSyncBroadcast(
  broadcast: SyncBroadcast,
  options: ReconciliationOptions = {},
): P5ReconciliationResult {
  if (
    options.localActorId !== undefined &&
    broadcast.changeSet.originActorId === options.localActorId
  ) {
    for (const requestId of broadcast.changeSet.originRequestIds) {
      clearPendingRequest(requestId);
    }
  }

  return applyIncomingChangeSet(broadcast.changeSet, options);
}

export function replayBufferedSyncEvents(options: ReconciliationOptions = {}): void {
  const state = getSocketState();
  const buffered = state.bufferedSyncEvents;
  state.bufferedSyncEvents = [];

  for (const event of buffered) {
    if ('status' in event) {
      processSyncAck(event, options);
    } else {
      processSyncBroadcast(event, options);
    }
  }
}

function clearPendingRequest(requestId: string): void {
  const state = getSocketState();
  state.pendingSyncRequests = state.pendingSyncRequests.filter(
    (request) => request.requestId !== requestId,
  );
}

function applyIncomingChangeSet(
  changeSet: CommittedChangeSet,
  options: ReconciliationOptions,
): P5ReconciliationResult {
  const state = getSocketState();
  if (changeSet.serverClock <= state.lastServerClock) {
    return { status: 'ignored-stale', serverClock: changeSet.serverClock };
  }

  if (changeSet.serverClock > state.lastServerClock + 1) {
    state.bufferedSyncEvents = [
      ...state.bufferedSyncEvents,
      {
        protocolVersion: changeSet.protocolVersion,
        schemaVersion: changeSet.schemaVersion,
        roomId: changeSet.roomId,
        serverClock: changeSet.serverClock,
        changeSet,
      },
    ];
    requestRoomDiff(changeSet, options);
    return { status: 'gap', serverClock: changeSet.serverClock };
  }

  applyChangeSetToStore(changeSet);
  setLastServerClock(changeSet.serverClock);
  return { status: 'applied', serverClock: changeSet.serverClock };
}

function requestRoomDiff(changeSet: CommittedChangeSet, options: ReconciliationOptions): void {
  const state = getSocketState();
  if (options.requestRoomDiff) {
    options.requestRoomDiff(changeSet.roomId, state.lastServerClock, changeSet.serverClock);
    return;
  }
  state.socket?.emit(WS_EVENTS.ROOM_DIFF_REQUEST, {
    roomId: changeSet.roomId,
    fromClock: state.lastServerClock,
    toClock: changeSet.serverClock,
  });
}

function applyChangeSetToStore(changeSet: CommittedChangeSet): void {
  const elements = useElementsStore.getState().elements;
  useElementsStore.getState().setElements(applyChangeSetToElements(elements, changeSet));
}
