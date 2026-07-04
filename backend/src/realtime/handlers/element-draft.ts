import type { Socket } from 'socket.io';
import { WS_EVENTS } from '@vdt/shared';
import type { ElementDraftPayload } from '../types.js';

export function handleElementDraft(socket: Socket, payload: ElementDraftPayload): void {
  const { roomId, sessionId, elements: draftElements } = payload;
  if (socket.data?.roomId !== roomId) return;
  socket.to(roomId).emit(WS_EVENTS.ELEMENT_DRAFT, { sessionId, elements: draftElements });
}
