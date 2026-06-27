import { io, type Socket } from 'socket.io-client';
import { WS_EVENTS } from '../types/shared';
import type { Element } from '../types/shared';
import { registerMutationHook } from '../store/mutation-pipeline';
import { applyRemoteElements, isApplyingRemote } from './apply-remote';

const SERVER_URL = import.meta.env?.VITE_BACKEND_URL ?? 'http://localhost:3001';

let _socket: Socket | null = null;
let _unregisterHook: (() => void) | null = null;

export function initSocketClient(roomId: string): void {
  if (_socket) return;

  _socket = io(SERVER_URL);

  _socket.emit(WS_EVENTS.JOIN_ROOM, { roomId });

  _socket.on(WS_EVENTS.ELEMENT_UPDATE, (data: { elements: Element[] }) => {
    applyRemoteElements(data.elements);
  });

  _unregisterHook = registerMutationHook((event) => {
    if (isApplyingRemote()) return;
    if (!_socket) return;
    _socket.emit(WS_EVENTS.ELEMENT_UPDATE, { roomId, elements: event.elements });
  });
}

export function stopSocketClient(): void {
  _unregisterHook?.();
  _unregisterHook = null;
  _socket?.disconnect();
  _socket = null;
}
