import { io, type Socket } from 'socket.io-client';
import { WS_EVENTS } from '../types/shared';
import type { Element, Presence } from '../types/shared';
import { registerMutationHook } from '../store/mutation-pipeline';
import { applyRemoteElements, isApplyingRemote } from './apply-remote';
import { useInteractionStore } from '../store/interaction.store';
import { LOCAL_PRESENCE } from './presence';

const SERVER_URL = import.meta.env?.VITE_BACKEND_URL ?? 'http://localhost:3001';

let _socket: Socket | null = null;
let _unregisterHook: (() => void) | null = null;
let _roomId: string | null = null;

export function initSocketClient(roomId: string): void {
  if (_socket) return;
  _roomId = roomId;

  _socket = io(SERVER_URL);

  // Include session identity in JOIN_ROOM so the server can register our presence
  _socket.emit(WS_EVENTS.JOIN_ROOM, {
    roomId,
    sessionId: LOCAL_PRESENCE.sessionId,
    name: LOCAL_PRESENCE.name,
    color: LOCAL_PRESENCE.color,
  });

  _socket.on(WS_EVENTS.ELEMENT_UPDATE, (data: { elements: Element[] }) => {
    applyRemoteElements(data.elements);
  });

  // Server sends full presence list whenever anyone joins
  _socket.on(WS_EVENTS.USER_JOIN, (data: { presences: Presence[] }) => {
    const { setRemoteCursors } = useInteractionStore.getState();
    const current = new Map(useInteractionStore.getState().remoteCursors);
    for (const p of data.presences) {
      if (p.sessionId === LOCAL_PRESENCE.sessionId) continue; // skip self
      current.set(p.sessionId, p);
    }
    setRemoteCursors(current);
  });

  // Server notifies when a peer leaves
  _socket.on(WS_EVENTS.USER_LEAVE, (data: { sessionId: string }) => {
    const { setRemoteCursors } = useInteractionStore.getState();
    const current = new Map(useInteractionStore.getState().remoteCursors);
    current.delete(data.sessionId);
    setRemoteCursors(current);
  });

  // Server relays cursor position from a peer (never own sessionId)
  _socket.on(
    WS_EVENTS.CURSOR_MOVE,
    (data: { sessionId: string; cursor: { x: number; y: number } }) => {
      const { setRemoteCursors } = useInteractionStore.getState();
      const current = new Map(useInteractionStore.getState().remoteCursors);
      const existing = current.get(data.sessionId);
      if (existing) {
        current.set(data.sessionId, { ...existing, cursor: data.cursor });
        setRemoteCursors(current);
      }
    },
  );

  _unregisterHook = registerMutationHook((event) => {
    if (isApplyingRemote()) return;
    if (!_socket) return;
    _socket.emit(WS_EVENTS.ELEMENT_UPDATE, { roomId, elements: event.elements });
  });
}

export function emitCursorMove(cursor: { x: number; y: number }): void {
  if (!_socket || !_roomId) return;
  _socket.emit(WS_EVENTS.CURSOR_MOVE, {
    roomId: _roomId,
    sessionId: LOCAL_PRESENCE.sessionId,
    cursor,
  });
}

export function stopSocketClient(): void {
  _unregisterHook?.();
  _unregisterHook = null;
  _socket?.disconnect();
  _socket = null;
  _roomId = null;
  // Clear all remote cursors when we leave the room (T018)
  useInteractionStore.getState().setRemoteCursors(new Map());
}
