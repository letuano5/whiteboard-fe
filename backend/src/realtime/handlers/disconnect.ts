import type { Server, Socket } from 'socket.io';
import { WS_EVENTS } from '@vdt/shared';
import type { ResolvedWhiteboardServerDeps } from '../types.js';

export function handleDisconnect(
  ioServer: Server,
  socket: Socket,
  deps: ResolvedWhiteboardServerDeps,
): void {
  const { sessionId, roomId } = socket.data;
  const { roomPresence: presence, autosave: save } = deps;

  console.log(`client disconnected ${socket.id} (sessionId: ${sessionId})`);

  if (roomId && sessionId) {
    const roomMap = presence.get(roomId);
    if (roomMap) {
      roomMap.delete(socket.id);
      if (roomMap.size === 0) {
        presence.delete(roomId);
        save.flushRoomNow(roomId).catch((err: unknown) => {
          console.error(`[autosave] flushRoomNow failed for room ${roomId}:`, err);
        });
      }
    }
    ioServer.to(roomId).emit(WS_EVENTS.USER_LEAVE, { sessionId });
  }
}
