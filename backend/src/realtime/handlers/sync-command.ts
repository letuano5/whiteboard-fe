import type { Socket } from 'socket.io';
import {
  WS_EVENTS,
  type EffectiveRoomRole,
  type RoomReplacedPayload,
  type SyncBroadcast,
  type SyncCommand,
} from '@vdt/shared';
import { canMutateRoom, resolveRoomAccess } from '../../rooms/room-roles.js';
import {
  createSyncAck,
  createSyncRejectAck,
  SyncRoomCommandError,
  withSyncRoom,
} from '../../sync/index.js';
import type { ResolvedWhiteboardServerDeps } from '../types.js';

export async function handleSyncCommand(
  socket: Socket,
  deps: ResolvedWhiteboardServerDeps,
  command: SyncCommand,
): Promise<void> {
  try {
    if (socket.data?.roomId !== command.roomId) {
      emitReject(socket, deps, command, new SyncRoomCommandError('FORBIDDEN'));
      return;
    }

    const effectiveRole = await resolveEffectiveRole(socket, deps, command.roomId);
    if (!canMutateRoom(effectiveRole ?? 'none')) {
      emitReject(socket, deps, command, new SyncRoomCommandError('FORBIDDEN'));
      return;
    }

    const result = await withSyncRoom(
      deps.db,
      deps.syncRooms,
      command.roomId,
      (room) =>
        room.execute(command, {
          actorId: socket.data?.auth?.user?.id ?? null,
          effectiveRole,
        }),
    );
    const ack = createSyncAck(result);
    const broadcast: SyncBroadcast = {
      protocolVersion: result.changeSet.protocolVersion,
      schemaVersion: result.changeSet.schemaVersion,
      roomId: result.changeSet.roomId,
      serverClock: result.changeSet.serverClock,
      changeSet: result.changeSet,
    };

    // Idempotent replays re-send the original ACK to the caller but must not
    // re-broadcast to peers or re-mark the room dirty: the state did not change.
    socket.emit(WS_EVENTS.SYNC_ACK, ack);
    if (!result.replayed) {
      socket.to(command.roomId).emit(WS_EVENTS.SYNC_BROADCAST, broadcast);
      if (result.changeSet.reason === 'replace_document') {
        const replacedPayload = toRoomReplacedPayload(result.changeSet);
        socket.emit(WS_EVENTS.ROOM_REPLACED, replacedPayload);
        socket.to(command.roomId).emit(WS_EVENTS.ROOM_REPLACED, replacedPayload);
      }
    }
  } catch (error) {
    if (shouldEmitRejectAck(error)) {
      emitReject(socket, deps, command, error);
    }
  }
}

async function resolveEffectiveRole(
  socket: Socket,
  deps: ResolvedWhiteboardServerDeps,
  roomId: string,
): Promise<EffectiveRoomRole | undefined> {
  const user = socket.data?.auth?.user;
  let access: Awaited<ReturnType<typeof resolveRoomAccess>>;
  try {
    access = await resolveRoomAccess(deps.db, roomId, user);
  } catch {
    throw new SyncRoomCommandError('FORBIDDEN');
  }
  const socketRole = socket.data.roomRole;
  const admittedRole =
    socket.data.roomRoleCapacityDowngraded || (socketRole && !canMutateRoom(socketRole))
      ? socketRole
      : null;
  const effectiveRole = admittedRole ?? access.effectiveRole;
  socket.data.roomBaseRole = access.baseRole;
  socket.data.roomRole = effectiveRole;
  return effectiveRole;
}

function emitReject(
  socket: Socket,
  deps: ResolvedWhiteboardServerDeps,
  command: SyncCommand,
  error: unknown,
): void {
  const serverClock = deps.syncRooms.get(command.roomId)?.getStateSnapshot().documentClock ?? 0;
  socket.emit(WS_EVENTS.SYNC_ACK, createSyncRejectAck(command, error, serverClock));
}

function shouldEmitRejectAck(error: unknown): boolean {
  return error instanceof SyncRoomCommandError && error.code !== 'ROOM_UNHEALTHY';
}

function toRoomReplacedPayload(changeSet: SyncBroadcast['changeSet']): RoomReplacedPayload {
  return {
    protocolVersion: changeSet.protocolVersion,
    schemaVersion: changeSet.schemaVersion,
    roomId: changeSet.roomId,
    serverClock: changeSet.serverClock,
    roomEpoch: changeSet.roomEpoch,
    elements: changeSet.puts.length > 0 ? changeSet.puts : changeSet.created,
    slotClocks: changeSet.slotClocks,
  };
}
