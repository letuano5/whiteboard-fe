import type { Socket } from 'socket.io';
import { WS_EVENTS } from '@vdt/shared';
import type { ElementDraftPayload } from '../types.js';

export function handleElementDraft(socket: Socket, payload: ElementDraftPayload): void {
  const { roomId, elements: draftElements } = payload;
  const sessionId = socket.data?.sessionId;
  if (socket.data?.roomId !== roomId || !sessionId) return;
  socket.to(roomId).emit(WS_EVENTS.ELEMENT_DRAFT, { sessionId, elements: draftElements });
}
