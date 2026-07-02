import type {
  CommittedChangeSet,
  RoomDiff,
  RoomReplacedPayload,
  RoomSnapshot,
  SlotClockUpdate,
  SyncAck,
  SyncBroadcast,
  SyncClock,
} from '../../types/shared';
import { WS_EVENTS } from '../../types/shared';
import { useElementsStore } from '../../store/elements.store';
import { applyChangeSetToElements, applySlotPatch, slotValueFromElement } from './p5-change-set';
import {
  applyKnownSlotClocks,
  consumeStaleAckRequest,
  getKnownSlotClock,
  getRoomEpochState,
  getSocketState,
  hydrateKnownSlotClocks,
  markPendingRequestsStale,
  removeKnownSlotClocks,
  setLastServerClock,
  setRoomEpoch,
  type PendingSyncRequest,
} from './state';

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
  const state = getSocketState();
  const isPending = state.pendingSyncRequests.some(
    (request) => request.requestId === ack.requestId,
  );
  if (!isPending && consumeStaleAckRequest(ack.requestId)) {
    return { status: 'ignored-stale', serverClock: ack.serverClock };
  }

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

export function applyRoomSnapshot(snapshot: RoomSnapshot): void {
  useElementsStore.getState().setElements(snapshot.elements);
  hydrateKnownSlotClocks(snapshot.slotClocks);
  setRoomEpoch(snapshot.roomEpoch);
  setLastServerClock(snapshot.serverClock);
}

export function applyRoomReplaced(payload: RoomReplacedPayload): void {
  const state = getSocketState();
  markPendingRequestsStale();
  state.bufferedSyncEvents = [];
  useElementsStore.getState().setElements(payload.elements);
  hydrateKnownSlotClocks(payload.slotClocks);
  setRoomEpoch(payload.roomEpoch);
  setLastServerClock(payload.serverClock);
}

export function applyRoomDiff(diff: RoomDiff): void {
  const previousLastServerClock = getSocketState().lastServerClock;
  const deletedIds = diff.deleted.map((deleted) => deleted.id);
  const currentById = new Map(
    useElementsStore.getState().elements.map((element) => [element.id, element]),
  );
  const slotClocksByElement = groupSlotClocks(diff.slotClocks);
  const nextById = new Map(currentById);

  for (const deletedId of deletedIds) nextById.delete(deletedId);

  for (const incoming of diff.changed) {
    const existing = nextById.get(incoming.id);
    const slotClocks = slotClocksByElement.get(incoming.id) ?? [];
    if (!existing) {
      nextById.set(incoming.id, incoming);
      continue;
    }
    if (slotClocks.length === 0) continue;

    let next = existing;
    for (const slotClock of slotClocks) {
      const previousSlotClock = getKnownSlotClock(incoming.id, slotClock.slot);
      if (slotClock.clock <= previousSlotClock || slotClock.clock <= previousLastServerClock) {
        continue;
      }
      next = applySlotPatch(next, {
        elementId: incoming.id,
        slot: slotClock.slot,
        baseClock: previousSlotClock,
        changes: slotValueFromElement(slotClock.slot, incoming),
      });
    }
    nextById.set(incoming.id, next);
  }

  useElementsStore.getState().setElements([...nextById.values()]);
  removeKnownSlotClocks(deletedIds);
  applyKnownSlotClocks(diff.slotClocks);
  setRoomEpoch(diff.roomEpoch);
  setLastServerClock(diff.serverClock);
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
    lastServerClock: state.lastServerClock,
    roomEpoch: getRoomEpochState(),
    pendingRequestIds: state.pendingSyncRequests.map((request) => request.requestId),
    fromClock: state.lastServerClock,
    toClock: changeSet.serverClock,
  });
}

function applyChangeSetToStore(changeSet: CommittedChangeSet): void {
  const elements = useElementsStore.getState().elements;
  useElementsStore.getState().setElements(applyChangeSetToElements(elements, changeSet));
  applyKnownSlotClocks(changeSet.slotClocks);
  setRoomEpoch(changeSet.roomEpoch);
}

function groupSlotClocks(slotClocks: SlotClockUpdate[]): Map<string, SlotClockUpdate[]> {
  const grouped = new Map<string, SlotClockUpdate[]>();
  for (const slotClock of slotClocks) {
    grouped.set(slotClock.elementId, [...(grouped.get(slotClock.elementId) ?? []), slotClock]);
  }
  return grouped;
}
