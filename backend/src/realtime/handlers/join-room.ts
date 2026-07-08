import type { Server, Socket } from 'socket.io';
import {
  SYNC_PROTOCOL_VERSION,
  SYNC_SCHEMA_VERSION,
  WS_EVENTS,
  type RoomSnapshot,
} from '@vdt/shared';
import { getRoomDiff } from '../../persistence/room-repository.js';
import { resolveRoomAccess, RoomAccessError } from '../../rooms/room-roles.js';
import { getOrCreateSyncRoom } from '../../sync/index.js';
import type { JoinRoomPayload, ResolvedWhiteboardServerDeps } from '../types.js';

export async function handleJoinRoom(
  ioServer: Server,
  socket: Socket,
  deps: ResolvedWhiteboardServerDeps,
  payload: JoinRoomPayload,
): Promise<void> {
  const { roomId, sessionId, name, color, lastServerClock, roomEpoch, pendingRequests } = payload;
  const { roomPresence: presence, db } = deps;

  try {
    const roomMap = presence.get(roomId);
    const access = await resolveRoomAccess(db, roomId, socket.data?.auth?.user, {
      activePresences: roomMap?.values(),
      currentSessionId: sessionId,
    });
    socket.data.roomBaseRole = access.baseRole;
    socket.data.roomRole = access.effectiveRole;
    socket.data.roomRoleCapacityDowngraded = isEditorCapacityDowngrade(
      access,
      roomMap?.values(),
      sessionId,
    );
    socket.emit(WS_EVENTS.ROOM_ACCESS, access);
  } catch (err) {
    if (err instanceof RoomAccessError) {
      socket.emit(WS_EVENTS.ROOM_ACCESS_ERROR, {
        code: err.code,
        message: err.message,
      });
      return;
    }

    console.error('[room-access] DB error during join:', err);
    socket.emit(WS_EVENTS.ROOM_ACCESS_ERROR, {
      code: 'room-access/forbidden',
      message: 'Could not resolve room access.',
    });
    return;
  }

  socket.join(roomId);
  socket.data.sessionId = sessionId;
  socket.data.roomId = roomId;

  if (!presence.has(roomId)) {
    presence.set(roomId, new Map());
  }
  const roomMap = presence.get(roomId)!;
  roomMap.set(socket.id, {
    sessionId,
    userId: socket.data?.auth?.user?.id,
    name,
    color,
    cursor: null,
    selectedIds: [],
    status: 'active',
    baseRole: socket.data.roomBaseRole,
    effectiveRole: socket.data.roomRole,
  });

  console.log(`socket ${socket.id} (${name}) joined room ${roomId}`);

  let documentClock = 0;
  let currentRoomEpoch = 0;
  let snapshotElements: RoomSnapshot['elements'] = [];
  let slotClocks: RoomSnapshot['slotClocks'] = [];
  try {
    const syncRoom = await getOrCreateSyncRoom(db, deps.syncRooms, roomId);
    const syncRoomSnapshot = syncRoom.getStateSnapshot();
    snapshotElements = [...syncRoomSnapshot.elements.values()];
    documentClock = syncRoomSnapshot.documentClock;
    currentRoomEpoch = syncRoomSnapshot.roomEpoch;
    slotClocks = toSlotClockUpdates(syncRoomSnapshot.slotClocks);
  } catch (err) {
    console.error('[load-room] DB error during join:', err);
    const syncRoomSnapshot = deps.syncRooms.get(roomId)?.getStateSnapshot();
    if (syncRoomSnapshot) {
      snapshotElements = [...syncRoomSnapshot.elements.values()];
      documentClock = syncRoomSnapshot.documentClock;
      currentRoomEpoch = syncRoomSnapshot.roomEpoch;
      slotClocks = toSlotClockUpdates(syncRoomSnapshot.slotClocks);
    }
  }

  if (lastServerClock !== undefined && lastServerClock > 0) {
    try {
      const diffResult = await getRoomDiff(db, roomId, lastServerClock, snapshotElements, {
        roomEpoch,
        pendingRequests: pendingRequests ?? [],
        actorId: socket.data?.auth?.user?.id ?? null,
      });
      // Emit the clock the diff/snapshot was materialized at (P5-07). The mirror
      // clock (`clocks`) can lead the transactional read and would advance the
      // client's lastServerClock past changes it never received.
      const diffServerClock = diffResult.serverClock;

      if (diffResult.mode === 'diff') {
        socket.emit(WS_EVENTS.ROOM_DIFF, {
          protocolVersion: SYNC_PROTOCOL_VERSION,
          schemaVersion: SYNC_SCHEMA_VERSION,
          roomId,
          fromClock: diffResult.fromClock,
          toClock: diffResult.toClock,
          serverClock: diffServerClock,
          documentClock: diffServerClock,
          roomEpoch: diffResult.roomEpoch,
          changed: diffResult.changed,
          deleted: diffResult.deleted,
          slotClocks: diffResult.slotClocks,
          hasMore: diffResult.hasMore,
          nextFromClock: diffResult.nextFromClock,
          pendingRequests: diffResult.pendingRequests,
        });
      } else {
        socket.emit(WS_EVENTS.ROOM_SNAPSHOT, {
          protocolVersion: SYNC_PROTOCOL_VERSION,
          schemaVersion: SYNC_SCHEMA_VERSION,
          roomId,
          serverClock: diffServerClock,
          documentClock: diffServerClock,
          roomEpoch: diffResult.roomEpoch,
          elements: diffResult.elements,
          slotClocks: diffResult.slotClocks,
          processedRequestHistoryStartsAtClock: diffResult.processedRequestHistoryStartsAtClock,
          wipeAll: true,
          pendingRequests: diffResult.pendingRequests,
        });
      }
    } catch (err) {
      console.error('[reconnect-diff] DB error, falling back to full snapshot:', err);
      socket.emit(
        WS_EVENTS.ROOM_SNAPSHOT,
        createRoomSnapshot(roomId, snapshotElements, documentClock, currentRoomEpoch, slotClocks, {
          wipeAll: true,
        }),
      );
    }
  } else {
    socket.emit(
      WS_EVENTS.ROOM_SNAPSHOT,
      createRoomSnapshot(roomId, snapshotElements, documentClock, currentRoomEpoch, slotClocks),
    );
  }

  const presences = [...roomMap.values()];
  ioServer.to(roomId).emit(WS_EVENTS.USER_JOIN, { presences });
}

function createRoomSnapshot(
  roomId: string,
  elements: RoomSnapshot['elements'],
  serverClock: number,
  roomEpoch: number,
  slotClocks: RoomSnapshot['slotClocks'],
  options: Pick<
    RoomSnapshot,
    'pendingRequests' | 'processedRequestHistoryStartsAtClock' | 'wipeAll'
  > = {},
): RoomSnapshot & { documentClock: number } {
  return {
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId,
    serverClock,
    documentClock: serverClock,
    roomEpoch,
    elements,
    slotClocks,
    ...options,
  };
}

function toSlotClockUpdates(slotClockMap: ReadonlyMap<string, number>): RoomSnapshot['slotClocks'] {
  return [...slotClockMap.entries()].flatMap(([key, clock]) => {
    const separator = key.lastIndexOf(':');
    if (separator <= 0) return [];
    return [{ elementId: key.slice(0, separator), slot: key.slice(separator + 1), clock }];
  }) as RoomSnapshot['slotClocks'];
}

interface AccessForAdmission {
  baseRole: string;
  effectiveRole: string;
  maxEditors: number | null;
}

function isEditorCapacityDowngrade(
  access: AccessForAdmission,
  activePresences: Iterable<{ sessionId: string; effectiveRole?: string }> | undefined,
  currentSessionId: string,
): boolean {
  if (access.baseRole !== 'editor' || access.effectiveRole !== 'viewer' || !access.maxEditors) {
    return false;
  }

  const activeEditorCount = [...(activePresences ?? [])].filter(
    (presence) => presence.sessionId !== currentSessionId && presence.effectiveRole === 'editor',
  ).length;
  return activeEditorCount >= access.maxEditors;
}
