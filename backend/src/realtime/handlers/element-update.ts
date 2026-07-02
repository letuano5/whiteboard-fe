import type { Socket } from 'socket.io';
import { WS_EVENTS } from '@vdt/shared';
import { canMutateRoom, resolveRoomAccess } from '../../rooms/room-roles.js';
import { executeSyncCommand, type LegacyElementUpdateResult } from '../../sync/index.js';
import type { ElementUpdatePayload, ResolvedWhiteboardServerDeps } from '../types.js';

export async function handleElementUpdate(
  socket: Socket,
  deps: ResolvedWhiteboardServerDeps,
  payload: ElementUpdatePayload,
): Promise<void> {
  const { roomId, elements, sessionId } = payload;
  const { db } = deps;

  const user = socket.data?.auth?.user;
  if (socket.data?.roomId !== roomId) {
    socket.emit(WS_EVENTS.ROOM_ACCESS_ERROR, {
      code: 'room-access/forbidden',
      message: 'Socket is not joined to this room.',
    });
    return;
  }

  try {
    const access = await resolveRoomAccess(db, roomId, user);
    const admittedRole = socket.data.roomRoleCapacityDowngraded ? socket.data.roomRole : null;
    const effectiveRole =
      admittedRole && !canMutateRoom(admittedRole) ? admittedRole : access.effectiveRole;
    socket.data.roomBaseRole = access.baseRole;
    socket.data.roomRole = effectiveRole;
    if (!canMutateRoom(effectiveRole)) {
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

  if (await isPersistedRoom(db, roomId)) {
    socket.emit(WS_EVENTS.ROOM_ACCESS_ERROR, {
      code: 'room-access/forbidden',
      message: 'Saved documents must use the P5 sync command protocol.',
    });
    return;
  }

  const result = executeSyncCommand(
    {
      kind: 'legacy-element-update',
      roomId,
      elements,
      sessionId,
    },
    {
      actorId: user?.id ?? null,
      db,
      roomElements: deps.roomElements,
      roomClocks: deps.roomClocks,
      autosave: deps.autosave,
    },
  );

  if (isPromise(result)) {
    emitCommittedElementUpdate(socket, await result);
    return;
  }

  emitCommittedElementUpdate(socket, result);
}

async function isPersistedRoom(
  db: ResolvedWhiteboardServerDeps['db'],
  roomId: string,
): Promise<boolean> {
  const roomDelegate = db.room as unknown as {
    findUnique?: (args: {
      where: { id: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
  if (!roomDelegate.findUnique) return false;
  try {
    return (
      (await roomDelegate.findUnique({ where: { id: roomId }, select: { id: true } })) !== null
    );
  } catch {
    return true;
  }
}

function emitCommittedElementUpdate(socket: Socket, result: LegacyElementUpdateResult): void {
  // Compatibility broadcast for the pre-P5 client contract. The authoritative
  // saved-room mutation has already been executed by the sync module.
  socket.to(result.roomId).emit(WS_EVENTS.ELEMENT_UPDATE, {
    elements: result.elements,
    sessionId: result.sessionId,
    documentClock: result.documentClock,
  });
}

function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as Promise<T>).then === 'function';
}
