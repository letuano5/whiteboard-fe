import type { Socket } from 'socket.io';
import { WS_EVENTS } from '@vdt/shared';
import { getRoomClock } from '../../persistence/room-repository.js';
import type { ElementUpdatePayload, ResolvedWhiteboardServerDeps } from '../types.js';

export async function handleElementUpdate(
  socket: Socket,
  deps: ResolvedWhiteboardServerDeps,
  payload: ElementUpdatePayload,
): Promise<void> {
  const { roomId, elements: incoming, sessionId } = payload;
  const { roomElements: elements, roomClocks: clocks, autosave: save, db } = deps;

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
