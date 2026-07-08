import type {
  CommittedChangeSet,
  Element,
  PendingRequestStatus,
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
import { useHistoryStore } from '../../store/history.store';
import { applyChangeSetToElements, applySlotPatch, slotValueFromElement } from './p5-change-set';
import {
  clearDurablePendingSyncCommands,
  consumeHydratedDurableRequestIds,
} from './p5-durable-outbox';
import {
  clearPendingSyncCommands,
  materializeOptimisticElements,
  reconcilePendingCommandStatuses,
  settleSyncCommandRequest,
} from './p5-command-queue';
import {
  applyKnownSlotClocks,
  addKnownTombstones,
  consumeStaleAckRequest,
  getKnownSlotClock,
  getPendingRequestRefs,
  getRoomEpochState,
  getSocketState,
  hydrateKnownSlotClocks,
  markPendingRequestsStale,
  removeKnownSlotClocks,
  removeKnownTombstones,
  setLastServerClock,
  setRoomEpoch,
} from './state';

export type P5ReconciliationResult =
  | { status: 'applied'; serverClock: SyncClock }
  | { status: 'ignored-stale'; serverClock: SyncClock }
  | { status: 'gap'; serverClock: SyncClock };

interface ReconciliationOptions {
  localActorId?: string | null;
  requestRoomDiff?: (roomId: string, lastServerClock: SyncClock, incomingClock: SyncClock) => void;
}

export function processSyncAck(
  ack: SyncAck,
  options: ReconciliationOptions = {},
): P5ReconciliationResult {
  const state = getSocketState();
  const isPending = state.inFlightSyncCommands.some(
    (queued) => queued.command.requestId === ack.requestId,
  );
  if (!isPending && consumeStaleAckRequest(ack.requestId)) {
    return { status: 'ignored-stale', serverClock: ack.serverClock };
  }

  clearPendingRequest(ack.requestId);
  settleSyncCommandRequest(ack.requestId);

  if (ack.status === 'reject') {
    if (ack.serverChangeSet) {
      return applyIncomingChangeSet(ack.serverChangeSet, options);
    }
    rematerializeOptimisticStore();
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
      settleSyncCommandRequest(requestId);
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
  const state = getSocketState();
  state.serverElements = snapshot.elements;
  state.hasServerState = true;
  state.pausedForResync = false;
  useElementsStore.getState().setElements(materializeOptimisticElements(snapshot.elements));
  hydrateKnownSlotClocks(snapshot.slotClocks);
  removeKnownTombstones(snapshot.elements.map((element) => element.id));
  setRoomEpoch(snapshot.roomEpoch);
  setLastServerClock(snapshot.serverClock);
  reconcilePendingRequests(pendingStatusesOrUnknown(snapshot.pendingRequests));
  rematerializeOptimisticStore();
}

export function applyRoomReplaced(payload: RoomReplacedPayload): void {
  const state = getSocketState();
  markPendingRequestsStale();
  clearDurablePendingSyncCommands(payload.roomId);
  clearPendingSyncCommands();
  state.bufferedSyncEvents = [];
  state.serverElements = payload.elements;
  state.hasServerState = true;
  state.tombstoneElementIds = new Set();
  useElementsStore.getState().setElements(payload.elements);
  hydrateKnownSlotClocks(payload.slotClocks);
  setRoomEpoch(payload.roomEpoch);
  setLastServerClock(payload.serverClock);
  useHistoryStore.getState().clear();
}

export function applyRoomDiff(diff: RoomDiff): void {
  const state = getSocketState();
  const previousLastServerClock = state.lastServerClock;
  const deletedIds = diff.deleted.map((deleted) => deleted.id);
  const serverElements = getCurrentServerElements();
  const currentById = new Map(serverElements.map((element) => [element.id, element]));
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

  const nextServerElements = [...nextById.values()];
  state.serverElements = nextServerElements;
  state.hasServerState = true;
  state.pausedForResync = false;
  useElementsStore.getState().setElements(materializeOptimisticElements(nextServerElements));
  removeKnownSlotClocks(deletedIds);
  addKnownTombstones(deletedIds);
  removeKnownTombstones(diff.changed.map((element) => element.id));
  applyKnownSlotClocks(diff.slotClocks);
  setRoomEpoch(diff.roomEpoch);
  setLastServerClock(diff.serverClock);
  reconcilePendingRequests(pendingStatusesOrUnknown(diff.pendingRequests));
  rematerializeOptimisticStore();
}

export function rematerializeOptimisticStore(): void {
  useElementsStore
    .getState()
    .setElements(materializeOptimisticElements(getCurrentServerElements()));
}

function clearPendingRequest(requestId: string): void {
  const state = getSocketState();
  state.inFlightSyncCommands = state.inFlightSyncCommands.filter(
    (queued) => queued.command.requestId !== requestId,
  );
}

function applyIncomingChangeSet(
  changeSet: CommittedChangeSet,
  options: ReconciliationOptions,
): P5ReconciliationResult {
  const state = getSocketState();
  if (changeSet.serverClock <= state.lastServerClock || changeSet.roomEpoch < state.roomEpoch) {
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
    pendingRequests: getPendingRequestRefs(),
    fromClock: state.lastServerClock,
    toClock: changeSet.serverClock,
  });
}

function applyChangeSetToStore(changeSet: CommittedChangeSet): void {
  const state = getSocketState();
  const serverElements = getCurrentServerElements();
  const nextServerElements = applyChangeSetToElements(serverElements, changeSet);
  state.serverElements = nextServerElements;
  state.hasServerState = true;
  useElementsStore.getState().setElements(materializeOptimisticElements(nextServerElements));
  if (changeSet.reason === 'replace_document') {
    state.tombstoneElementIds = new Set();
  } else {
    addKnownTombstones(changeSet.deletes);
  }
  removeKnownTombstones([
    ...changeSet.created.map((element) => element.id),
    ...changeSet.puts.map((element) => element.id),
  ]);
  applyKnownSlotClocks(changeSet.slotClocks);
  setRoomEpoch(changeSet.roomEpoch);
}

function getCurrentServerElements(): Element[] {
  const state = getSocketState();
  return state.hasServerState ? state.serverElements : useElementsStore.getState().elements;
}

function groupSlotClocks(slotClocks: SlotClockUpdate[]): Map<string, SlotClockUpdate[]> {
  const grouped = new Map<string, SlotClockUpdate[]>();
  for (const slotClock of slotClocks) {
    grouped.set(slotClock.elementId, [...(grouped.get(slotClock.elementId) ?? []), slotClock]);
  }
  return grouped;
}

function reconcilePendingRequests(pendingRequests: PendingRequestStatus[]): void {
  const state = getSocketState();
  for (const status of pendingRequests) {
    switch (status.status) {
      case 'processed':
        // Server already committed this request: drop it and let the replayed
        // ACK (if any) apply the committed change set.
        reconcilePendingCommandStatuses([status]);
        break;
      case 'conflict':
      case 'expired':
        // Not safe to replay: drop the pending entry and mark any late ACK stale.
        state.staleAckRequestIds.add(status.requestId);
        reconcilePendingCommandStatuses([status]);
        break;
      case 'unknown':
        // Server never saw this request. P5-07 allows resend only after the
        // command is still relevant against the freshly hydrated server truth.
        reconcilePendingCommandStatuses([status]);
        break;
    }
  }
}

function pendingStatusesOrUnknown(
  pendingRequests: PendingRequestStatus[] | undefined,
): PendingRequestStatus[] {
  const hydratedRequestIds = consumeHydratedDurableRequestIds();
  if (pendingRequests) return pendingRequests;
  if (hydratedRequestIds.size === 0) return [];
  return getSocketState()
    .inFlightSyncCommands.filter((queued) => hydratedRequestIds.has(queued.command.requestId))
    .map((queued) => ({
      requestId: queued.command.requestId,
      status: 'unknown',
    }));
}
