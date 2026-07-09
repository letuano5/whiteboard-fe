import { Server, type Socket } from 'socket.io';
import { WS_EVENTS, type SyncCommand } from '@vdt/shared';
import { createSocketAuthMiddleware } from '../auth/index.js';
import { prisma } from '../persistence/prisma.js';
import { handleCursorMove } from './handlers/cursor-move.js';
import { handleDisconnect } from './handlers/disconnect.js';
import { handleElementDraft } from './handlers/element-draft.js';
import { handleJoinRoom } from './handlers/join-room.js';
import { handleRoomDiffRequest } from './handlers/room-diff-request.js';
import { handleRoomRoleUpdate } from './handlers/room-role-update.js';
import { handleSyncCommand } from './handlers/sync-command.js';
import type {
  CursorMovePayload,
  ElementDraftPayload,
  JoinRoomPayload,
  RoomDiffRequestPayload,
  RoomRoleUpdatePayload,
  ResolvedWhiteboardServerDeps,
  WhiteboardServerDeps,
} from './types.js';

type SocketEventHandler<TPayload> = (payload: TPayload) => void | Promise<void>;

function resolveDeps(deps: WhiteboardServerDeps): ResolvedWhiteboardServerDeps {
  return {
    roomPresence: deps.roomPresence,
    db: deps.db ?? prisma,
    syncRooms: deps.syncRooms ?? new Map(),
  };
}

export function createWhiteboardServer(ioServer: Server, deps: WhiteboardServerDeps): void {
  const resolvedDeps = resolveDeps(deps);

  if (deps.authVerifier) {
    ioServer.use(
      createSocketAuthMiddleware(deps.authVerifier, {
        appUserRepository: deps.appUserRepository,
        allowAnonymous: true,
      }),
    );
  }

  ioServer.on('connection', (socket: Socket) => {
    console.log('client connected', socket.id);

    socket.on(
      WS_EVENTS.JOIN_ROOM,
      catchSocketHandler(socket, WS_EVENTS.JOIN_ROOM, (payload: JoinRoomPayload) =>
        handleJoinRoom(socket, resolvedDeps, payload),
      ),
    );

    socket.on(
      WS_EVENTS.SYNC_COMMAND,
      catchSocketHandler(socket, WS_EVENTS.SYNC_COMMAND, (payload: SyncCommand) =>
        handleSyncCommand(socket, resolvedDeps, payload),
      ),
    );

    socket.on(
      WS_EVENTS.ROOM_DIFF_REQUEST,
      catchSocketHandler(socket, WS_EVENTS.ROOM_DIFF_REQUEST, (payload: RoomDiffRequestPayload) =>
        handleRoomDiffRequest(socket, resolvedDeps, payload),
      ),
    );

    socket.on(
      WS_EVENTS.ELEMENT_DRAFT,
      catchSocketHandler(socket, WS_EVENTS.ELEMENT_DRAFT, (payload: ElementDraftPayload) =>
        handleElementDraft(socket, payload),
      ),
    );

    socket.on(
      WS_EVENTS.ROOM_ROLE_UPDATE,
      catchSocketHandler(socket, WS_EVENTS.ROOM_ROLE_UPDATE, (payload: RoomRoleUpdatePayload) =>
        handleRoomRoleUpdate(ioServer, socket, resolvedDeps, payload),
      ),
    );

    socket.on(
      WS_EVENTS.CURSOR_MOVE,
      catchSocketHandler(socket, WS_EVENTS.CURSOR_MOVE, (payload: CursorMovePayload) =>
        handleCursorMove(socket, payload),
      ),
    );

    socket.on('disconnect', () => handleDisconnect(ioServer, socket, resolvedDeps));
  });
}

function catchSocketHandler<TPayload>(
  socket: Socket,
  eventName: string,
  handler: SocketEventHandler<TPayload>,
): SocketEventHandler<TPayload> {
  return (payload: TPayload) => {
    return Promise.resolve()
      .then(() => handler(payload))
      .catch((error: unknown) => {
        console.error(`[socket:${eventName}] Unexpected handler error:`, error);
        socket.emit(WS_EVENTS.ROOM_ACCESS_ERROR, {
          code: 'room-access/forbidden',
          message: 'Realtime request could not be processed.',
        });
      });
  };
}
