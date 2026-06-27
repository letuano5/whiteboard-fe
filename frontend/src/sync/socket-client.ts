import { io, type Socket } from 'socket.io-client';
import { WS_EVENTS } from '../types/shared';
import type { Element, Presence } from '../types/shared';
import { registerMutationHook } from '../store/mutation-pipeline';
import { applyRemoteElements, isApplyingRemote } from './apply-remote';
import { useInteractionStore } from '../store/interaction.store';
import { useElementsStore } from '../store/elements.store';
import { useCameraStore } from '../store/camera.store';
import { saveCamera } from './camera-persistence';
import { LOCAL_PRESENCE } from './presence';

const SERVER_URL = import.meta.env?.VITE_BACKEND_URL ?? 'http://localhost:3001';

let _socket: Socket | null = null;
let _unregisterHook: (() => void) | null = null;
let _unsubCamera: (() => void) | null = null;
let _viewportThrottle: ReturnType<typeof setTimeout> | null = null;
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

  // Full room snapshot received when joining — replaces localStorage hydration
  _socket.on(WS_EVENTS.ROOM_SNAPSHOT, (data: { elements: Element[] }) => {
    useElementsStore.getState().setElements(data.elements);
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

  // Server relays cursor + viewport from a peer.
  // cursor may be null for viewport-only updates (camera pan/zoom without mouse move).
  // If sessionId === own session (same user, another tab) → sync camera instead of showing remote cursor.
  _socket.on(
    WS_EVENTS.CURSOR_MOVE,
    (data: {
      sessionId: string;
      cursor: { x: number; y: number } | null;
      viewport?: { x: number; y: number; zoom: number };
    }) => {
      if (data.sessionId === LOCAL_PRESENCE.sessionId) {
        // Same user, different tab — apply their camera to ours and persist it
        if (data.viewport && _roomId) {
          useCameraStore.getState().setCamera(data.viewport);
          saveCamera(_roomId, data.viewport);
        }
        return;
      }

      const { setRemoteCursors } = useInteractionStore.getState();
      const current = new Map(useInteractionStore.getState().remoteCursors);
      const existing = current.get(data.sessionId);
      if (existing) {
        current.set(data.sessionId, {
          ...existing,
          // null cursor = viewport-only update; preserve the last known cursor position
          ...(data.cursor !== null ? { cursor: data.cursor } : {}),
          ...(data.viewport !== undefined ? { viewport: data.viewport } : {}),
        });
        setRemoteCursors(current);
      }
    },
  );

  _unregisterHook = registerMutationHook((event) => {
    if (isApplyingRemote()) return;
    if (!_socket) return;
    _socket.emit(WS_EVENTS.ELEMENT_UPDATE, { roomId, elements: event.elements });
  });

  // Broadcast viewport to peers when camera changes without cursor movement (throttled ~200ms)
  _unsubCamera = useCameraStore.subscribe((state, prevState) => {
    if (state.camera === prevState.camera) return;
    if (_viewportThrottle !== null) return;
    _viewportThrottle = setTimeout(() => {
      _viewportThrottle = null;
      if (!_socket || !_roomId) return;
      _socket.emit(WS_EVENTS.CURSOR_MOVE, {
        roomId: _roomId,
        sessionId: LOCAL_PRESENCE.sessionId,
        cursor: null, // viewport-only: receiver preserves existing cursor position
        viewport: useCameraStore.getState().camera,
      });
    }, 200);
  });
}

export function emitCursorMove(cursor: { x: number; y: number }): void {
  if (!_socket || !_roomId) return;
  _socket.emit(WS_EVENTS.CURSOR_MOVE, {
    roomId: _roomId,
    sessionId: LOCAL_PRESENCE.sessionId,
    cursor,
    viewport: useCameraStore.getState().camera,
  });
}

export function stopSocketClient(): void {
  _unregisterHook?.();
  _unregisterHook = null;
  _unsubCamera?.();
  _unsubCamera = null;
  if (_viewportThrottle !== null) {
    clearTimeout(_viewportThrottle);
    _viewportThrottle = null;
  }
  _socket?.disconnect();
  _socket = null;
  _roomId = null;
  // Clear all remote cursors when we leave the room (T018)
  useInteractionStore.getState().setRemoteCursors(new Map());
}
