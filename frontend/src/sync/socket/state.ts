import type {
  Element,
  PendingRequestRef,
  SlotClockUpdate,
  SyncAck,
  SyncBroadcast,
  SyncClock,
  SyncCommand,
  SyncSlot,
} from '../../types/shared';
import type { WhiteboardSocket } from './types';

interface SocketClientState {
  socket: WhiteboardSocket | null;
  lastServerClock: number;
  roomEpoch: number;
  knownSlotClocks: Map<string, Map<SyncSlot, SyncClock>>;
  unregisterHook: (() => void) | null;
  unsubCamera: (() => void) | null;
  unsubSelection: (() => void) | null;
  unsubDraft: (() => void) | null;
  viewportThrottle: ReturnType<typeof setTimeout> | null;
  selectionThrottle: ReturnType<typeof setTimeout> | null;
  draftThrottle: ReturnType<typeof setTimeout> | null;
  roomId: string | null;
  hasJoined: boolean;
  reconnectPending: boolean;
  pendingQueue: Element[];
  pendingSyncRequests: PendingSyncRequest[];
  queuedSyncCommands: QueuedSyncCommand[];
  inFlightSyncCommands: QueuedSyncCommand[];
  syncFlushTimer: ReturnType<typeof setTimeout> | null;
  pausedForResync: boolean;
  serverElements: Element[];
  hasServerState: boolean;
  staleAckRequestIds: Set<string>;
  bufferedSyncEvents: Array<SyncAck | SyncBroadcast>;
}

export interface PendingSyncRequest {
  requestId: string;
  actorId: string | null;
  clientClock: SyncClock;
}

export interface QueuedSyncCommand {
  command: SyncCommand;
  dependsOnRequestId?: string;
  sendAfter: number;
  createdAt: number;
}

const state: SocketClientState = {
  socket: null,
  lastServerClock: 0,
  roomEpoch: 0,
  knownSlotClocks: new Map(),
  unregisterHook: null,
  unsubCamera: null,
  unsubSelection: null,
  unsubDraft: null,
  viewportThrottle: null,
  selectionThrottle: null,
  draftThrottle: null,
  roomId: null,
  hasJoined: false,
  reconnectPending: false,
  pendingQueue: [],
  pendingSyncRequests: [],
  queuedSyncCommands: [],
  inFlightSyncCommands: [],
  syncFlushTimer: null,
  pausedForResync: false,
  serverElements: [],
  hasServerState: false,
  staleAckRequestIds: new Set(),
  bufferedSyncEvents: [],
};

export function getSocketState(): SocketClientState {
  return state;
}

export function getLastServerClockState(): number {
  return state.lastServerClock;
}

export function setLastServerClock(documentClock: number): void {
  state.lastServerClock = documentClock;
}

export function getRoomEpochState(): number {
  return state.roomEpoch;
}

export function setRoomEpoch(roomEpoch: number): void {
  state.roomEpoch = roomEpoch;
}

export function getKnownSlotClock(elementId: string, slot: SyncSlot): SyncClock {
  return state.knownSlotClocks.get(elementId)?.get(slot) ?? 0;
}

export function hydrateKnownSlotClocks(slotClocks: SlotClockUpdate[]): void {
  state.knownSlotClocks = new Map();
  applyKnownSlotClocks(slotClocks);
}

export function applyKnownSlotClocks(slotClocks: SlotClockUpdate[]): void {
  for (const slotClock of slotClocks) {
    const elementClocks = state.knownSlotClocks.get(slotClock.elementId) ?? new Map();
    elementClocks.set(
      slotClock.slot,
      Math.max(elementClocks.get(slotClock.slot) ?? 0, slotClock.clock),
    );
    state.knownSlotClocks.set(slotClock.elementId, elementClocks);
  }
}

export function removeKnownSlotClocks(elementIds: string[]): void {
  for (const elementId of elementIds) state.knownSlotClocks.delete(elementId);
}

/**
 * Builds the `{ requestId, clientClock }` refs sent to the server for reconnect/resync
 * requests. The server uses `clientClock` to tell a genuinely GC'd request apart from one
 * that was simply never received (see `getPendingRequestStatuses` on the backend).
 */
export function getPendingRequestRefs(): PendingRequestRef[] {
  return state.pendingSyncRequests.map((request) => ({
    requestId: request.requestId,
    clientClock: request.clientClock,
  }));
}

export function markPendingRequestsStale(): string[] {
  const requestIds = state.pendingSyncRequests.map((request) => request.requestId);
  for (const requestId of requestIds) {
    state.staleAckRequestIds.add(requestId);
  }
  state.pendingSyncRequests = [];
  state.inFlightSyncCommands = [];
  return requestIds;
}

export function consumeStaleAckRequest(requestId: string): boolean {
  const existed = state.staleAckRequestIds.delete(requestId);
  return existed;
}

export function resetReconnectState(): void {
  state.lastServerClock = 0;
  state.pendingQueue = [];
  state.pendingSyncRequests = [];
  state.queuedSyncCommands = [];
  state.inFlightSyncCommands = [];
  if (state.syncFlushTimer !== null) {
    clearTimeout(state.syncFlushTimer);
    state.syncFlushTimer = null;
  }
  state.pausedForResync = false;
  state.serverElements = [];
  state.hasServerState = false;
  state.staleAckRequestIds = new Set();
  state.bufferedSyncEvents = [];
  state.knownSlotClocks = new Map();
  state.roomEpoch = 0;
  state.hasJoined = false;
  state.reconnectPending = false;
}
