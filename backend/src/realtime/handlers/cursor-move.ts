import type { Socket } from 'socket.io';
import { WS_EVENTS } from '@vdt/shared';
import type { CursorMovePayload } from '../types.js';

export function handleCursorMove(socket: Socket, payload: CursorMovePayload): void {
  const { roomId, cursor, viewport, selectedIds } = payload;
  const sessionId = socket.data?.sessionId;
  if (socket.data?.roomId !== roomId || !sessionId) return;
  socket.to(roomId).emit(WS_EVENTS.CURSOR_MOVE, { sessionId, cursor, viewport, selectedIds });
}
