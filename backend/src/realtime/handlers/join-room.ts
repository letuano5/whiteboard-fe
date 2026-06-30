import type { Server, Socket } from 'socket.io';
import { WS_EVENTS } from '@vdt/shared';
import {
  getRoomClock,
  getRoomDiff,
  loadRoomElements,
} from '../../persistence/room-repository.js';
import { resolveRoomAccess } from '../../rooms/room-roles.js';
import type { JoinRoomPayload, ResolvedWhiteboardServerDeps } from '../types.js';

export async function handleJoinRoom(
  ioServer: Server,
  socket: Socket,
  deps: ResolvedWhiteboardServerDeps,
  payload: JoinRoomPayload,
): Promise<void> {
  const { roomId, sessionId, name, color, lastServerClock } = payload;
  const { roomPresence: presence, roomElements: elements, roomClocks: clocks, db } = deps;

  socket.join(roomId);
  socket.data.sessionId = sessionId;
  socket.data.roomId = roomId;

  try {
    const access = await resolveRoomAccess(db, roomId, socket.data?.auth?.user);
    socket.data.roomRole = access.role;
    socket.emit(WS_EVENTS.ROOM_ACCESS, access);
  } catch (err) {
    console.error('[room-access] DB error during join:', err);
    socket.data.roomRole = 'viewer';
    socket.emit(WS_EVENTS.ROOM_ACCESS_ERROR, {
      code: 'room-access/forbidden',
      message: 'Could not resolve room access.',
    });
  }

  if (!presence.has(roomId)) {
    presence.set(roomId, new Map());
  }
  const roomMap = presence.get(roomId)!;
  roomMap.set(socket.id, {
    sessionId,
    name,
    color,
    cursor: null,
    selectedIds: [],
    status: 'active',
  });

  console.log(`socket ${socket.id} (${name}) joined room ${roomId}`);

  let documentClock = 0;
  try {
    const elMap = elements.get(roomId);
    if (!elMap || elMap.size === 0) {
      const loaded = await loadRoomElements(db, roomId);
      if (!elements.has(roomId)) elements.set(roomId, new Map());
      for (const el of loaded.elements) elements.get(roomId)!.set(el.id, el);
      clocks.set(roomId, loaded.documentClock);
      documentClock = loaded.documentClock;
    } else {
      if (!clocks.has(roomId)) {
        clocks.set(roomId, await getRoomClock(db, roomId));
      }
      documentClock = clocks.get(roomId) ?? 0;
    }
  } catch (err) {
    console.error('[load-room] DB error during join:', err);
    documentClock = clocks.get(roomId) ?? 0;
  }

  if (lastServerClock !== undefined && lastServerClock > 0) {
    try {
      const inMemory = elements.has(roomId) ? [...elements.get(roomId)!.values()] : [];
      const diffResult = await getRoomDiff(db, roomId, lastServerClock, inMemory);

      if (diffResult.mode === 'diff') {
        socket.emit(WS_EVENTS.ROOM_DIFF, {
          changed: diffResult.changed,
          deleted: diffResult.deleted,
          documentClock: clocks.get(roomId) ?? diffResult.documentClock,
        });
      } else {
        socket.emit(WS_EVENTS.ROOM_SNAPSHOT, {
          elements: diffResult.elements,
          documentClock: clocks.get(roomId) ?? diffResult.documentClock,
        });
      }
    } catch (err) {
      console.error('[reconnect-diff] DB error, falling back to full snapshot:', err);
      const snapshot = elements.has(roomId) ? [...elements.get(roomId)!.values()] : [];
      socket.emit(WS_EVENTS.ROOM_SNAPSHOT, { elements: snapshot, documentClock });
    }
  } else {
    const snapshot = elements.has(roomId) ? [...elements.get(roomId)!.values()] : [];
    socket.emit(WS_EVENTS.ROOM_SNAPSHOT, { elements: snapshot, documentClock });
  }

  const presences = [...roomMap.values()];
  ioServer.to(roomId).emit(WS_EVENTS.USER_JOIN, { presences });
}
