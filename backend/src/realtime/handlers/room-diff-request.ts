import type { Socket } from 'socket.io';
import { WS_EVENTS } from '@vdt/shared';
import { getRoomDiff } from '../../persistence/room-repository.js';
import type { ResolvedWhiteboardServerDeps, RoomDiffRequestPayload } from '../types.js';

export async function handleRoomDiffRequest(
  socket: Socket,
  deps: ResolvedWhiteboardServerDeps,
  payload: RoomDiffRequestPayload,
): Promise<void> {
  const { roomId, fromClock } = payload;
  const inMemory = deps.roomElements.has(roomId)
    ? [...deps.roomElements.get(roomId)!.values()]
    : [];

  try {
    const diffResult = await getRoomDiff(deps.db, roomId, fromClock, inMemory);
    const documentClock = deps.roomClocks.get(roomId) ?? diffResult.documentClock;

    if (diffResult.mode === 'diff') {
      socket.emit(WS_EVENTS.ROOM_DIFF, {
        changed: diffResult.changed,
        deleted: diffResult.deleted,
        documentClock,
      });
      return;
    }

    socket.emit(WS_EVENTS.ROOM_SNAPSHOT, {
      elements: diffResult.elements,
      documentClock,
    });
  } catch (error) {
    console.error(`[room-diff-request] Failed to compute diff for ${roomId}:`, error);
    socket.emit(WS_EVENTS.ROOM_SNAPSHOT, {
      elements: inMemory,
      documentClock: deps.roomClocks.get(roomId) ?? fromClock,
    });
  }
}
