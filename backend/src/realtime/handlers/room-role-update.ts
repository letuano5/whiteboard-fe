import type { Server, Socket } from 'socket.io';
import { WS_EVENTS, type RoomAccessPayload } from '@vdt/shared';
import { updateRoomMemberRole } from '../../rooms/room-access-management.js';
import { resolveRoomAccess, RoomAccessError } from '../../rooms/room-roles.js';
import type { ResolvedWhiteboardServerDeps, RoomRoleUpdatePayload } from '../types.js';

export async function handleRoomRoleUpdate(
  ioServer: Server,
  socket: Socket,
  deps: ResolvedWhiteboardServerDeps,
  payload: RoomRoleUpdatePayload,
): Promise<void> {
  const user = socket.data?.auth?.user;

  try {
    const access = await updateRoomMemberRole(
      deps.db,
      payload.roomId,
      user,
      payload.userId,
      payload.role,
    );
    await emitRoomAccessForRoomSockets(ioServer, socket, deps, payload.roomId, access);
  } catch (error) {
    if (error instanceof RoomAccessError) {
      socket.emit(WS_EVENTS.ROOM_ACCESS_ERROR, {
        code: error.code,
        message: error.message,
      });
      return;
    }

    console.error('[room-role-update] Unexpected error:', error);
    socket.emit(WS_EVENTS.ROOM_ACCESS_ERROR, {
      code: 'room-access/forbidden',
      message: 'Room role update failed.',
    });
  }
}

async function emitRoomAccessForRoomSockets(
  ioServer: Server,
  actorSocket: Socket,
  deps: ResolvedWhiteboardServerDeps,
  roomId: string,
  actorAccess: RoomAccessPayload,
): Promise<void> {
  const roomSockets = getRoomSockets(ioServer, roomId);
  if (!roomSockets.some((roomSocket) => roomSocket.id === actorSocket.id)) {
    roomSockets.push(actorSocket);
  }
  const activePresences = [...(deps.roomPresence.get(roomId)?.values() ?? [])];

  for (const roomSocket of roomSockets) {
    try {
      const access =
        roomSocket.id === actorSocket.id
          ? actorAccess
          : await resolveRoomAccess(deps.db, roomId, roomSocket.data?.auth?.user, {
              activePresences,
              currentSessionId: roomSocket.data?.sessionId,
            });
      setSocketAccess(roomSocket, access);
      updatePresenceAccess(deps, roomId, roomSocket.id, access);
      roomSocket.emit(WS_EVENTS.ROOM_ACCESS, access);
    } catch (error) {
      if (error instanceof RoomAccessError) {
        roomSocket.emit(WS_EVENTS.ROOM_ACCESS_ERROR, {
          code: error.code,
          message: error.message,
        });
        continue;
      }

      console.error('[room-role-update] Failed to refresh room access:', error);
      roomSocket.emit(WS_EVENTS.ROOM_ACCESS_ERROR, {
        code: 'room-access/forbidden',
        message: 'Room access refresh failed.',
      });
    }
  }
}

function getRoomSockets(ioServer: Server, roomId: string): Socket[] {
  const sockets = ioServer.sockets.sockets as Map<string, Socket>;
  return [...sockets.values()].filter((roomSocket) => {
    const socketRooms = roomSocket.rooms as Set<string> | undefined;
    return roomSocket.data?.roomId === roomId || socketRooms?.has(roomId) === true;
  });
}

function setSocketAccess(socket: Socket, access: RoomAccessPayload): void {
  socket.data.roomBaseRole = access.baseRole;
  socket.data.roomRole = access.effectiveRole;
  socket.data.roomRoleCapacityDowngraded =
    access.baseRole === 'editor' && access.effectiveRole === 'viewer';
}

function updatePresenceAccess(
  deps: ResolvedWhiteboardServerDeps,
  roomId: string,
  socketId: string,
  access: RoomAccessPayload,
): void {
  const presence = deps.roomPresence.get(roomId)?.get(socketId);
  if (!presence) return;
  presence.baseRole = access.baseRole;
  presence.effectiveRole = access.effectiveRole;
}
