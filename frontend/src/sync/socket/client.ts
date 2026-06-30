import { io } from 'socket.io-client';
import { WS_EVENTS } from '../../types/shared';
import { useCameraStore } from '../../store/camera.store';
import { useInteractionStore } from '../../store/interaction.store';
import { registerSocketEventHandlers } from './event-handlers';
import { getLastServerClockState, getSocketState, resetReconnectState } from './state';
import { clearSocketSubscriptions, registerSocketSubscriptions } from './subscriptions';
import { LOCAL_PRESENCE } from '../presence';

const SERVER_URL = import.meta.env?.VITE_BACKEND_URL ?? 'http://localhost:3001';

export function getLastServerClock(): number {
  return getLastServerClockState();
}

export function initSocketClient(roomId: string): void {
  const state = getSocketState();
  if (state.socket) return;

  state.roomId = roomId;
  state.socket = io(SERVER_URL);

  registerSocketEventHandlers();
  registerSocketSubscriptions(roomId);
}

export function emitCursorMove(cursor: { x: number; y: number }): void {
  const state = getSocketState();
  if (!state.socket || !state.roomId) return;
  state.socket.emit(WS_EVENTS.CURSOR_MOVE, {
    roomId: state.roomId,
    sessionId: LOCAL_PRESENCE.sessionId,
    cursor,
    viewport: useCameraStore.getState().camera,
  });
}

export function stopSocketClient(): void {
  const state = getSocketState();

  clearSocketSubscriptions();
  state.socket?.disconnect();
  state.socket = null;
  state.roomId = null;
  state.lastServerClock = 0;
  resetReconnectState();

  const { setRemoteCursors, setRemoteDrafts } = useInteractionStore.getState();
  setRemoteCursors(new Map());
  setRemoteDrafts(new Map());
}
