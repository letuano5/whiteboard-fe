import type { Socket } from 'socket.io';
import { WS_EVENTS } from '@vdt/shared';
import { getRoomClock } from '../../persistence/room-repository.js';
import { canMutateRoom, resolveRoomAccess } from '../../rooms/room-roles.js';
import type { ElementUpdatePayload, ResolvedWhiteboardServerDeps } from '../types.js';

export async function handleElementUpdate(
  socket: Socket,
  deps: ResolvedWhiteboardServerDeps,
  payload: ElementUpdatePayload,
): Promise<void> {
  const { roomId, elements: incoming, sessionId } = payload;
  const { roomElements: elements, roomClocks: clocks, autosave: save, db } = deps;

  const user = socket.data?.auth?.user;
  if (user) {
    try {
      const access = await resolveRoomAccess(db, roomId, user);
      socket.data.roomRole = access.effectiveRole;
      if (!canMutateRoom(access.effectiveRole)) {
        socket.emit(WS_EVENTS.ROOM_ACCESS_ERROR, {
          code: 'room-access/forbidden',
          message: 'Viewers cannot mutate room elements.',
        });
        return;
      }
    } catch (err) {
      console.error(`[room-access] Failed to authorize mutation for ${roomId}:`, err);
      socket.emit(WS_EVENTS.ROOM_ACCESS_ERROR, {
        code: 'room-access/forbidden',
        message: 'Could not authorize room mutation.',
      });
      return;
    }
  } else if (!canMutateRoom(socket.data?.roomRole ?? 'editor')) {
    socket.emit(WS_EVENTS.ROOM_ACCESS_ERROR, {
      code: 'room-access/forbidden',
      message: 'Viewers cannot mutate room elements.',
    });
    return;
  }

  if (!elements.has(roomId)) {
    elements.set(roomId, new Map());
  }
  const elMap = elements.get(roomId)!;
  for (const el of incoming) {
    elMap.set(el.id, el);
  }

  if (!clocks.has(roomId)) {
    try {
      clocks.set(roomId, await getRoomClock(db, roomId));
    } catch (err) {
      console.error(`[delta-clock] Failed to load room clock for ${roomId}:`, err);
      clocks.set(roomId, 0);
    }
  }

  const newClock = (clocks.get(roomId) ?? 0) + 1;
  clocks.set(roomId, newClock);

  save.markDirty(roomId);

  socket.to(roomId).emit(WS_EVENTS.ELEMENT_UPDATE, {
    elements: incoming,
    sessionId,
    documentClock: newClock,
  });
}
