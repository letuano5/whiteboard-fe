import type { Server, Socket } from 'socket.io';
import { WS_EVENTS } from '@vdt/shared';
import { updateRoomMemberRole } from '../../rooms/room-access-management.js';
import { RoomAccessError } from '../../rooms/room-roles.js';
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
    ioServer.to(payload.roomId).emit(WS_EVENTS.ROOM_ACCESS, access);
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
