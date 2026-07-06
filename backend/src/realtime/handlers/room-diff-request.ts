import type { Socket } from 'socket.io';
import { SYNC_PROTOCOL_VERSION, SYNC_SCHEMA_VERSION, WS_EVENTS } from '@vdt/shared';
import { getRoomDiff } from '../../persistence/room-repository.js';
import { touchRoomCache } from '../room-cache-gc.js';
import type { ResolvedWhiteboardServerDeps, RoomDiffRequestPayload } from '../types.js';

export async function handleRoomDiffRequest(
  socket: Socket,
  deps: ResolvedWhiteboardServerDeps,
  payload: RoomDiffRequestPayload,
): Promise<void> {
  const { roomId, fromClock, lastServerClock, roomEpoch, pendingRequests = [] } = payload;

  if (socket.data?.roomId !== roomId) {
    socket.emit(WS_EVENTS.ROOM_ACCESS_ERROR, {
      code: 'room-access/forbidden',
      message: 'Join the room before requesting a diff.',
    });
    return;
  }

  const baseClock = lastServerClock ?? fromClock ?? 0;
  if (deps.roomElements.has(roomId)) {
    touchRoomCache(deps.roomElements, roomId);
  }
  const inMemory = deps.roomElements.has(roomId)
    ? [...deps.roomElements.get(roomId)!.values()]
    : [];

  try {
    const diffResult = await getRoomDiff(deps.db, roomId, baseClock, inMemory, {
      roomEpoch,
      pendingRequests,
      actorId: socket.data?.auth?.user?.id ?? null,
    });
    // Emit the clock the diff was actually materialized at (P5-07): using the
    // in-memory mirror clock here could advance the client's lastServerClock past
    // changes that were never included in `changed`/`slotClocks`.
    const serverClock = diffResult.serverClock ?? diffResult.documentClock;

    if (diffResult.mode === 'diff') {
      socket.emit(WS_EVENTS.ROOM_DIFF, {
        protocolVersion: SYNC_PROTOCOL_VERSION,
        schemaVersion: SYNC_SCHEMA_VERSION,
        roomId,
        fromClock: diffResult.fromClock,
        toClock: diffResult.toClock,
        serverClock,
        documentClock: serverClock,
        roomEpoch: diffResult.roomEpoch,
        changed: diffResult.changed,
        deleted: diffResult.deleted,
        slotClocks: diffResult.slotClocks,
        hasMore: diffResult.hasMore,
        nextFromClock: diffResult.nextFromClock,
        pendingRequests: diffResult.pendingRequests,
      });
      return;
    }

    socket.emit(WS_EVENTS.ROOM_SNAPSHOT, {
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId,
      serverClock,
      documentClock: serverClock,
      roomEpoch: diffResult.roomEpoch,
      elements: diffResult.elements,
      slotClocks: diffResult.slotClocks,
      processedRequestHistoryStartsAtClock: diffResult.processedRequestHistoryStartsAtClock,
      wipeAll: true,
      pendingRequests: diffResult.pendingRequests,
    });
  } catch (error) {
    console.error(`[room-diff-request] Failed to compute diff for ${roomId}:`, error);
    socket.emit(WS_EVENTS.ROOM_ACCESS_ERROR, {
      code: 'room-access/forbidden',
      message: 'Could not compute room diff. Please reconnect and retry.',
    });
  }
}
