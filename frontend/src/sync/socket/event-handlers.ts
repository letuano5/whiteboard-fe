import { WS_EVENTS } from '../../types/shared';
import type { Element, Presence } from '../../types/shared';
import { useCameraStore } from '../../store/camera.store';
import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import { applyRemoteElements } from '../apply-remote';
import { saveCamera } from '../camera-persistence';
import { LOCAL_PRESENCE } from '../presence';
import { clearPendingQueue, replayPendingQueue } from './pending-queue';
import { getSocketState, setLastServerClock } from './state';
import type {
  CursorMovePayload,
  ElementUpdatePayload,
  RoomDiffPayload,
  RoomSnapshotPayload,
} from './types';

export function registerSocketEventHandlers(): void {
  const state = getSocketState();
  if (!state.socket) return;

  state.socket.on('connect', () => {
    const current = getSocketState();
    if (!current.socket || !current.roomId) return;

    if (current.hasJoined) {
      current.reconnectPending = true;
    }

    current.socket.emit(WS_EVENTS.JOIN_ROOM, {
      roomId: current.roomId,
      sessionId: LOCAL_PRESENCE.sessionId,
      name: LOCAL_PRESENCE.name,
      color: LOCAL_PRESENCE.color,
      lastServerClock: current.hasJoined ? current.lastServerClock : 0,
    });

    current.hasJoined = true;
  });

  state.socket.on(WS_EVENTS.ROOM_SNAPSHOT, (data: RoomSnapshotPayload) => {
    const current = getSocketState();
    setLastServerClock(data.documentClock);
    applyRemoteElements(data.elements);
    if (current.reconnectPending) {
      clearPendingQueue();
      current.reconnectPending = false;
    }
  });

  state.socket.on(WS_EVENTS.ROOM_DIFF, (data: RoomDiffPayload) => {
    const current = getSocketState();
    setLastServerClock(data.documentClock);
    applyRemoteElements(data.changed);
    useElementsStore.getState().removeElements(data.deleted.map((d) => d.id));
    current.reconnectPending = false;
    replayPendingQueue();
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
