import type { Server, Socket } from 'socket.io';
import { WS_EVENTS, type RoomAccessPayload } from '@vdt/shared';
import { resolveRoomAccess, RoomAccessError } from '../rooms/room-roles.js';
import type { ResolvedWhiteboardServerDeps } from './types.js';

export async function refreshRoomAccessForRoomSockets(
  ioServer: Server,
  deps: ResolvedWhiteboardServerDeps,
  roomId: string,
  options: RefreshRoomAccessOptions = {},
): Promise<void> {
  const roomSockets = getRoomSockets(ioServer, roomId);
  if (
    options.actorSocket &&
    !roomSockets.some((roomSocket) => roomSocket.id === options.actorSocket?.id)
  ) {
    roomSockets.push(options.actorSocket);
  }

  const activePresences = [...(deps.roomPresence.get(roomId)?.values() ?? [])];

  for (const roomSocket of roomSockets) {
    try {
      const access =
        options.actorSocket &&
        options.actorAccess &&
        roomSocket.id === options.actorSocket.id
          ? options.actorAccess
          : await resolveRoomAccess(deps.db, roomId, roomSocket.data?.auth?.user, {
              activePresences,
              currentSessionId: roomSocket.data?.sessionId,
            });
      setSocketAccess(roomSocket, access);
      updatePresenceAccess(deps, roomId, roomSocket.id, access);
      roomSocket.emit(WS_EVENTS.ROOM_ACCESS, access);
    } catch (error) {
      if (error instanceof RoomAccessError) {
        revokeSocketRoomAccess(ioServer, deps, roomSocket, roomId, {
          code: error.code,
          message: 'Room access changed. You no longer have permission to stay in this room.',
        });
        continue;
      }

      console.error('[room-access-refresh] Failed to refresh room access:', error);
      roomSocket.emit(WS_EVENTS.ROOM_ACCESS_ERROR, {
        code: 'room-access/forbidden',
        message: 'Room access refresh failed.',
      });
    }
  }
}

interface RefreshRoomAccessOptions {
  actorSocket?: Socket;
  actorAccess?: RoomAccessPayload;
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

function revokeSocketRoomAccess(
  ioServer: Server,
  deps: ResolvedWhiteboardServerDeps,
  socket: Socket,
  roomId: string,
  error: { code: RoomAccessError['code']; message: string },
): void {
  const sessionId = socket.data?.sessionId;
  socket.emit(WS_EVENTS.ROOM_ACCESS_ERROR, error);
  socket.leave(roomId);
  socket.data.roomId = '';
  delete socket.data.roomBaseRole;
  delete socket.data.roomRole;
  delete socket.data.roomRoleCapacityDowngraded;

  deps.roomPresence.get(roomId)?.delete(socket.id);
  if (deps.roomPresence.get(roomId)?.size === 0) {
    deps.roomPresence.delete(roomId);
  }

  if (sessionId) {
    ioServer.to(roomId).emit(WS_EVENTS.USER_LEAVE, { sessionId });
  }
}
