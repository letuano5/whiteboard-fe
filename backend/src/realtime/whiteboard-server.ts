import { Server, type Socket } from 'socket.io';
import { WS_EVENTS } from '@vdt/shared';
import { createSocketAuthMiddleware } from '../auth/index.js';
import { prisma } from '../persistence/prisma.js';
import { handleCursorMove } from './handlers/cursor-move.js';
import { handleDisconnect } from './handlers/disconnect.js';
import { handleElementDraft } from './handlers/element-draft.js';
import { handleElementUpdate } from './handlers/element-update.js';
import { handleJoinRoom } from './handlers/join-room.js';
import { handleRoomRoleUpdate } from './handlers/room-role-update.js';
import type {
  CursorMovePayload,
  ElementDraftPayload,
  ElementUpdatePayload,
  JoinRoomPayload,
  RoomRoleUpdatePayload,
  ResolvedWhiteboardServerDeps,
  WhiteboardServerDeps,
} from './types.js';

function resolveDeps(deps: WhiteboardServerDeps): ResolvedWhiteboardServerDeps {
  return {
    roomPresence: deps.roomPresence,
    roomElements: deps.roomElements,
    roomClocks: deps.roomClocks ?? new Map<string, number>(),
    autosave: deps.autosave,
    db: deps.db ?? prisma,
  };
}

export function createWhiteboardServer(ioServer: Server, deps: WhiteboardServerDeps): void {
  const resolvedDeps = resolveDeps(deps);

  if (deps.authVerifier) {
    ioServer.use(
      createSocketAuthMiddleware(deps.authVerifier, {
        appUserRepository: deps.appUserRepository,
      }),
    );
  }

  ioServer.on('connection', (socket: Socket) => {
    console.log('client connected', socket.id);

    socket.on(WS_EVENTS.JOIN_ROOM, (payload: JoinRoomPayload) =>
      handleJoinRoom(ioServer, socket, resolvedDeps, payload),
    );

    socket.on(WS_EVENTS.ELEMENT_UPDATE, (payload: ElementUpdatePayload) =>
      handleElementUpdate(socket, resolvedDeps, payload),
    );

    socket.on(WS_EVENTS.ELEMENT_DRAFT, (payload: ElementDraftPayload) =>
      handleElementDraft(socket, payload),
    );

    socket.on(WS_EVENTS.ROOM_ROLE_UPDATE, (payload: RoomRoleUpdatePayload) =>
      handleRoomRoleUpdate(ioServer, socket, resolvedDeps, payload),
    );

    socket.on(WS_EVENTS.CURSOR_MOVE, (payload: CursorMovePayload) =>
      handleCursorMove(socket, payload),
    );

    socket.on('disconnect', () => handleDisconnect(ioServer, socket, resolvedDeps));
  });
}
