import type { Request, Response, Router } from 'express';
import express from 'express';
import type { Server } from 'socket.io';
import type { PrismaClient } from '@prisma/client';
import {
  WS_EVENTS,
  isNativeFileDocument,
  type NativeFileDocument,
  type NativeFileImportMode,
} from '@vdt/shared';
import type { AuthVerifier } from '../auth/index.js';
import {
  createHttpAuthMiddleware,
  type AppUser,
  type AppUserRepository,
  type AuthenticatedRequest,
} from '../auth/index.js';
import { executeSyncCommand, type SyncRoom } from '../sync/index.js';
import { canMutateRoom, resolveRoomAccess, RoomAccessError } from './room-roles.js';

interface NativeFileImportDeps {
  authVerifier: AuthVerifier;
  appUserRepository: AppUserRepository;
  db: PrismaClient;
  ioServer?: Server;
  syncRooms?: Map<string, SyncRoom>;
  // In-memory hot-state mirrors used by the socket layer. Replace bumps roomEpoch
  // and rewrites the whole document, so these must be evicted; join-room then
  // rehydrates them from Postgres instead of serving the stale pre-import state.
  roomElements?: Map<string, unknown>;
  roomClocks?: Map<string, number>;
}

type RoomStateMirrors = Pick<
  NativeFileImportDeps,
  'ioServer' | 'syncRooms' | 'roomElements' | 'roomClocks'
>;

interface NativeFileImportPayload {
  document: NativeFileDocument;
  mode: NativeFileImportMode;
}

interface NativeFileImportResponse {
  importedElementCount: number;
  documentClock: string | null;
  roomEpoch: number;
}

interface NativeFileImportHttpError {
  error: {
    code: 'native-file/unauthenticated' | 'native-file/forbidden' | 'native-file/invalid-payload';
    message: string;
  };
}

export function createNativeFileImportRouter(deps: NativeFileImportDeps): Router {
  const router = express.Router();
  router.use(
    createHttpAuthMiddleware(deps.authVerifier, {
      appUserRepository: deps.appUserRepository,
    }),
  );
  router.use(express.json({ limit: '10mb' }));

  router.post(
    '/api/rooms/:roomId/import-native',
    (
      request: Request,
      response: Response<NativeFileImportResponse | NativeFileImportHttpError>,
    ) => {
      void handleNativeFileImport(request as AuthenticatedRequest, response, deps);
    },
  );

  return router;
}

export async function importNativeFileIntoRoom(
  db: PrismaClient,
  roomId: string,
  user: AppUser | undefined,
  document: NativeFileDocument,
): Promise<NativeFileImportResponse> {
  const authorizedUser = await assertCanImportNativeFile(db, roomId, user);
  return executeNativeFileReplace(db, roomId, authorizedUser, document);
}

export async function assertCanImportNativeFile(
  db: PrismaClient,
  roomId: string,
  user: AppUser | undefined,
): Promise<AppUser> {
  if (!user) {
    throw new NativeFileImportError(
      'native-file/unauthenticated',
      'Authentication is required to import into a saved document.',
    );
  }

  const access = await resolveRoomAccess(db, roomId, user);
  if (!canMutateRoom(access.effectiveRole)) {
    throw new NativeFileImportError(
      'native-file/forbidden',
      'Editor or owner access is required to import into this document.',
    );
  }

  return user;
}

async function executeNativeFileReplace(
  db: PrismaClient,
  roomId: string,
  user: AppUser,
  document: NativeFileDocument,
  opts: RoomStateMirrors = {},
): Promise<NativeFileImportResponse> {
  const result = await executeSyncCommand(
    {
      kind: 'native-file-import',
      roomId,
      elements: document.elements,
    },
    {
      actorId: user.id,
      db,
      // Route replace through the shared hot room so it serializes on the same
      // per-room actor as live socket commands instead of a throwaway room.
      syncRooms: opts.syncRooms,
    },
  );

  // Evict every in-memory mirror of the room so the next join/command reloads the
  // freshly replaced document (and bumped roomEpoch) from Postgres.
  opts.syncRooms?.delete(roomId);
  opts.roomElements?.delete(roomId);
  opts.roomClocks?.delete(roomId);
  if (opts.ioServer) {
    opts.ioServer.to(roomId).emit(WS_EVENTS.ROOM_REPLACED, result.replacePayload);
  }

  return {
    importedElementCount: result.importedElementCount,
    documentClock: result.documentClock,
    roomEpoch: result.roomEpoch,
  };
}

export function readNativeFileImportPayload(value: unknown): NativeFileImportPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const payload = value as Record<string, unknown>;
  if (payload.mode !== 'replace' && payload.mode !== 'merge') return null;
  if (!isNativeFileDocument(payload.document)) return null;
  return {
    document: payload.document,
    mode: payload.mode,
  };
}

class NativeFileImportError extends Error {
  constructor(
    public readonly code: NativeFileImportHttpError['error']['code'],
    message: string,
  ) {
    super(message);
    this.name = 'NativeFileImportError';
  }
}

async function handleNativeFileImport(
  request: AuthenticatedRequest,
  response: Response<NativeFileImportResponse | NativeFileImportHttpError>,
  deps: NativeFileImportDeps,
): Promise<void> {
  const roomId = readRoomId(request);
  let user: AppUser;
  try {
    user = await assertCanImportNativeFile(deps.db, roomId, request.auth.user);
  } catch (error) {
    sendKnownImportError(response, error);
    return;
  }

  const payload = readNativeFileImportPayload(request.body);
  if (!payload) {
    sendNativeFileError(response, 400, 'native-file/invalid-payload', 'Native file is invalid.');
    return;
  }

  try {
    response.json(
      await executeNativeFileReplace(deps.db, roomId, user, payload.document, {
        ioServer: deps.ioServer,
        syncRooms: deps.syncRooms,
        roomElements: deps.roomElements,
        roomClocks: deps.roomClocks,
      }),
    );
  } catch (error) {
    sendKnownImportError(response, error);
  }
}

function readRoomId(request: Request): string {
  const value = request.params.roomId;
  return typeof value === 'string' ? value : '';
}

function sendKnownImportError(response: Response<NativeFileImportHttpError>, error: unknown): void {
  if (error instanceof NativeFileImportError) {
    sendNativeFileError(
      response,
      error.code === 'native-file/unauthenticated' ? 401 : 403,
      error.code,
      error.message,
    );
    return;
  }

  if (error instanceof RoomAccessError) {
    sendNativeFileError(response, 403, 'native-file/forbidden', error.message);
    return;
  }

  throw error;
}

function sendNativeFileError(
  response: Response<NativeFileImportHttpError>,
  status: number,
  code: NativeFileImportHttpError['error']['code'],
  message: string,
): void {
  response.status(status).json({ error: { code, message } });
}
