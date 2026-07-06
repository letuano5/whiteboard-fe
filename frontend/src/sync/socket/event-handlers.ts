import { WS_EVENTS } from '../../types/shared';
import type {
  Element,
  Presence,
  RoomReplacedPayload,
  SyncAck,
  SyncBroadcast,
} from '../../types/shared';
import { useAuthStore } from '../../auth/auth.store';
import { useCameraStore } from '../../store/camera.store';
import { useInteractionStore } from '../../store/interaction.store';
import { useRoomAccessStore } from '../../rooms/room-access.store';
import { applyRemoteElements } from '../apply-remote';
import { saveCamera } from '../camera-persistence';
import { LOCAL_PRESENCE } from '../presence';
import { clearPendingQueue } from './pending-queue';
import {
  dropDurablePendingSyncCommands,
  hydratePendingSyncCommandsFromOutbox,
} from './p5-durable-outbox';
import { flushPendingSyncCommands } from './p5-command-queue';
import {
  applyRoomDiff,
  applyRoomReplaced,
  applyRoomSnapshot,
  processSyncAck,
  processSyncBroadcast,
  rematerializeOptimisticStore,
  replayBufferedSyncEvents,
} from './p5-reconciliation';
import {
  getPendingRequestRefs,
  getSocketState,
  markPendingRequestsStale,
  setLastServerClock,
} from './state';
import type {
  CursorMovePayload,
  ElementUpdatePayload,
  RoomAccessErrorPayload,
  RoomAccessPayload,
  RoomDiffPayload,
  RoomSnapshotPayload,
} from './types';

export function registerSocketEventHandlers(): void {
  const state = getSocketState();
  if (!state.socket) return;

  state.socket.on('connect', () => {
    void handleSocketConnect();
  });

  async function handleSocketConnect(): Promise<void> {
    const current = getSocketState();
    if (!current.socket || !current.roomId) return;

    if (current.hasJoined) {
      current.reconnectPending = true;
    }

    await hydratePendingSyncCommandsFromOutbox(current.roomId);
    if (!current.socket || !current.roomId) return;

    current.socket.emit(WS_EVENTS.JOIN_ROOM, {
      roomId: current.roomId,
      sessionId: LOCAL_PRESENCE.sessionId,
      name: LOCAL_PRESENCE.name,
      color: LOCAL_PRESENCE.color,
      lastServerClock: current.hasJoined ? current.lastServerClock : 0,
      roomEpoch: current.roomEpoch,
      pendingRequests: getPendingRequestRefs(),
    });

    current.hasJoined = true;
  }

  state.socket.on(WS_EVENTS.ROOM_SNAPSHOT, (data: RoomSnapshotPayload) => {
    const current = getSocketState();
    applyRoomSnapshot(normalizeSnapshotPayload(data));
    if (current.reconnectPending) {
      const staleRequestIds = markPendingRequestsStale();
      dropDurablePendingSyncCommands(current.roomId, staleRequestIds);
      clearPendingQueue();
      rematerializeOptimisticStore();
      current.reconnectPending = false;
    }
    replayBufferedSyncEvents({ localActorId: getLocalActorId() });
    if (!getSocketState().pausedForResync) {
      flushPendingSyncCommands(true);
    }
  });

  state.socket.on(WS_EVENTS.ROOM_DIFF, (data: RoomDiffPayload) => {
    const current = getSocketState();
    applyRoomDiff(normalizeDiffPayload(data));
    current.reconnectPending = false;
    replayBufferedSyncEvents({ localActorId: getLocalActorId() });
    if (!getSocketState().pausedForResync) {
      flushPendingSyncCommands(true);
    }
  });

  state.socket.on(WS_EVENTS.SYNC_ACK, (data: SyncAck) => {
    processSyncAck(data, { localActorId: getLocalActorId() });
  });

  state.socket.on(WS_EVENTS.SYNC_BROADCAST, (data: SyncBroadcast) => {
    processSyncBroadcast(data, { localActorId: getLocalActorId() });
  });

  state.socket.on(WS_EVENTS.ROOM_REPLACED, (data: RoomReplacedPayload) => {
    applyRoomReplaced(data);
  });

  state.socket.on(WS_EVENTS.ROOM_ACCESS, (data: RoomAccessPayload) => {
    useRoomAccessStore.getState().setRoomAccess(data);
  });

  state.socket.on(WS_EVENTS.ROOM_ACCESS_ERROR, (data: RoomAccessErrorPayload) => {
    useRoomAccessStore.getState().setRoomAccessError(data);
  });

  state.socket.on(WS_EVENTS.ELEMENT_UPDATE, (data: ElementUpdatePayload) => {
    applyRemoteElements(data.elements);
    if (data.documentClock !== undefined) setLastServerClock(data.documentClock);
    if (data.sessionId) {
      const { setRemoteDrafts } = useInteractionStore.getState();
      const current = new Map(useInteractionStore.getState().remoteDrafts);
      current.delete(data.sessionId);
      setRemoteDrafts(current);
    }
  });

  state.socket.on(WS_EVENTS.USER_JOIN, (data: { presences: Presence[] }) => {
    const { setRemoteCursors } = useInteractionStore.getState();
    const current = new Map(useInteractionStore.getState().remoteCursors);
    for (const p of data.presences) {
      if (p.sessionId === LOCAL_PRESENCE.sessionId) continue;
      current.set(p.sessionId, p);
    }
    setRemoteCursors(current);
  });

  state.socket.on(WS_EVENTS.USER_LEAVE, (data: { sessionId: string }) => {
    const { setRemoteCursors, setRemoteDrafts } = useInteractionStore.getState();
    const current = new Map(useInteractionStore.getState().remoteCursors);
    current.delete(data.sessionId);
    setRemoteCursors(current);

    const drafts = new Map(useInteractionStore.getState().remoteDrafts);
    drafts.delete(data.sessionId);
    setRemoteDrafts(drafts);
  });

  state.socket.on(WS_EVENTS.CURSOR_MOVE, (data: CursorMovePayload) => {
    const currentState = getSocketState();
    if (data.sessionId === LOCAL_PRESENCE.sessionId) {
      if (data.viewport && currentState.roomId) {
        useCameraStore.getState().setCamera(data.viewport);
        saveCamera(currentState.roomId, data.viewport);
      }
      return;
    }

    const { setRemoteCursors } = useInteractionStore.getState();
    const current = new Map(useInteractionStore.getState().remoteCursors);
    const existing = current.get(data.sessionId);
    if (existing) {
      current.set(data.sessionId, {
        ...existing,
        ...(data.cursor !== null ? { cursor: data.cursor } : {}),
        ...(data.viewport !== undefined ? { viewport: data.viewport } : {}),
        ...(data.selectedIds !== undefined ? { selectedIds: data.selectedIds } : {}),
      });
      setRemoteCursors(current);
    }
  });

  state.socket.on(WS_EVENTS.ELEMENT_DRAFT, (data: { sessionId: string; elements: Element[] }) => {
    const { setRemoteDrafts } = useInteractionStore.getState();
    const current = new Map(useInteractionStore.getState().remoteDrafts);
    if (data.elements.length === 0) {
      current.delete(data.sessionId);
    } else {
      current.set(data.sessionId, data.elements);
    }
    setRemoteDrafts(current);
  });
}

function normalizeSnapshotPayload(data: RoomSnapshotPayload): RoomSnapshotPayload {
  return {
    ...data,
    protocolVersion: data.protocolVersion ?? 1,
    schemaVersion: data.schemaVersion ?? 1,
    roomId: data.roomId ?? getSocketState().roomId ?? '',
    serverClock: data.serverClock ?? data.documentClock ?? 0,
    roomEpoch: data.roomEpoch ?? 0,
    slotClocks: data.slotClocks ?? [],
  };
}

function normalizeDiffPayload(data: RoomDiffPayload): RoomDiffPayload {
  const serverClock = data.serverClock ?? data.documentClock ?? 0;
  return {
    ...data,
    protocolVersion: data.protocolVersion ?? 1,
    schemaVersion: data.schemaVersion ?? 1,
    roomId: data.roomId ?? getSocketState().roomId ?? '',
    fromClock: data.fromClock ?? getSocketState().lastServerClock,
    toClock: data.toClock ?? serverClock,
    serverClock,
    roomEpoch: data.roomEpoch ?? getSocketState().roomEpoch,
    slotClocks: data.slotClocks ?? [],
    hasMore: data.hasMore ?? false,
  };
}

function getLocalActorId(): string | null {
  return useAuthStore.getState().session?.user.id ?? null;
}
