import type { Element } from '../../types/shared';
import type { WhiteboardSocket } from './types';

interface SocketClientState {
  socket: WhiteboardSocket | null;
  lastServerClock: number;
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
}

const state: SocketClientState = {
  socket: null,
  lastServerClock: 0,
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

export function resetReconnectState(): void {
  state.pendingQueue = [];
  state.hasJoined = false;
  state.reconnectPending = false;
}
