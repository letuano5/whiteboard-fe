import type { Socket } from 'socket.io';
import {
  WS_EVENTS,
  type EffectiveRoomRole,
  type SyncBroadcast,
  type SyncCommand,
} from '@vdt/shared';
import { canMutateRoom, resolveRoomAccess } from '../../rooms/room-roles.js';
import {
  createSyncAck,
  createSyncRejectAck,
  SyncRoom,
  SyncRoomCommandError,
} from '../../sync/index.js';
import type { ResolvedWhiteboardServerDeps } from '../types.js';

export async function handleSyncCommand(
  socket: Socket,
  deps: ResolvedWhiteboardServerDeps,
  command: SyncCommand,
): Promise<void> {
  try {
    const effectiveRole = await resolveEffectiveRole(socket, deps, command.roomId);
    if (!canMutateRoom(effectiveRole ?? 'editor')) {
      emitReject(socket, deps, command, new SyncRoomCommandError('FORBIDDEN'));
      return;
    }

    const room = getOrCreateSyncRoom(deps, command.roomId);
    const result = await room.execute(command, {
      actorId: socket.data?.auth?.user?.id ?? null,
      effectiveRole,
    });
    const ack = createSyncAck(result);
    const broadcast: SyncBroadcast = {
      protocolVersion: result.changeSet.protocolVersion,
      schemaVersion: result.changeSet.schemaVersion,
      roomId: result.changeSet.roomId,
      serverClock: result.changeSet.serverClock,
      changeSet: result.changeSet,
    };

    mirrorSyncRoomState(deps, command.roomId, room);

    // Idempotent replays re-send the original ACK to the caller but must not
    // re-broadcast to peers or re-mark the room dirty: the state did not change.
    socket.emit(WS_EVENTS.SYNC_ACK, ack);
    if (!result.replayed) {
      deps.autosave.markDirty(command.roomId);
      socket.to(command.roomId).emit(WS_EVENTS.SYNC_BROADCAST, broadcast);
    }
  } catch (error) {
    emitReject(socket, deps, command, error);
  }
}

async function resolveEffectiveRole(
  socket: Socket,
  deps: ResolvedWhiteboardServerDeps,
  roomId: string,
): Promise<EffectiveRoomRole | undefined> {
  const user = socket.data?.auth?.user;
  if (!user) return socket.data?.roomRole ?? 'editor';

  const access = await resolveRoomAccess(deps.db, roomId, user);
  const admittedRole = socket.data.roomRoleCapacityDowngraded ? socket.data.roomRole : null;
  const effectiveRole =
    admittedRole && !canMutateRoom(admittedRole) ? admittedRole : access.effectiveRole;
  socket.data.roomBaseRole = access.baseRole;
  socket.data.roomRole = effectiveRole;
  return effectiveRole;
}

function getOrCreateSyncRoom(deps: ResolvedWhiteboardServerDeps, roomId: string): SyncRoom {
  const existing = deps.syncRooms.get(roomId);
  if (existing) return existing;

  const room = new SyncRoom({
    roomId,
    elements: deps.roomElements.has(roomId) ? deps.roomElements.get(roomId)!.values() : [],
    documentClock: deps.roomClocks.get(roomId) ?? 0,
  });
  deps.syncRooms.set(roomId, room);
  return room;
}

function mirrorSyncRoomState(
  deps: ResolvedWhiteboardServerDeps,
  roomId: string,
  room: SyncRoom,
): void {
  const snapshot = room.getStateSnapshot();
  deps.roomElements.set(roomId, new Map(snapshot.elements));
  deps.roomClocks.set(roomId, snapshot.documentClock);
}

function emitReject(
  socket: Socket,
  deps: ResolvedWhiteboardServerDeps,
  command: SyncCommand,
  error: unknown,
): void {
  const serverClock =
    deps.syncRooms.get(command.roomId)?.getStateSnapshot().documentClock ??
    deps.roomClocks.get(command.roomId) ??
    0;
  socket.emit(WS_EVENTS.SYNC_ACK, createSyncRejectAck(command, error, serverClock));
}
