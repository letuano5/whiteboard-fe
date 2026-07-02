import type { Request, Response, Router } from 'express';
import express from 'express';
import type { PrismaClient } from '@prisma/client';
import { NATIVE_FILE_KIND, NATIVE_FILE_SCHEMA_VERSION, type NativeFileDocument } from '@vdt/shared';
import type { AuthVerifier } from '../auth/index.js';
import {
  createHttpAuthMiddleware,
  type AppUser,
  type AppUserRepository,
  type AuthenticatedRequest,
} from '../auth/index.js';
import { getOrCreateSyncRoom, type SyncRoom } from '../sync/index.js';
import { resolveRoomAccess, RoomAccessError } from './room-roles.js';

interface NativeFileExportDeps {
  authVerifier: AuthVerifier;
  appUserRepository: AppUserRepository;
  db: PrismaClient;
  syncRooms?: Map<string, SyncRoom>;
}

interface NativeFileExportResponse {
  document: NativeFileDocument;
  documentClock: string;
}

interface NativeFileExportHttpError {
  error: {
    code: 'native-file/unauthenticated' | 'native-file/forbidden';
    message: string;
  };
}

export function createNativeFileExportRouter(deps: NativeFileExportDeps): Router {
  const router = express.Router();
  router.use(
    createHttpAuthMiddleware(deps.authVerifier, {
      appUserRepository: deps.appUserRepository,
    }),
  );

  router.get(
    '/api/rooms/:roomId/export-native',
    (
      request: Request,
      response: Response<NativeFileExportResponse | NativeFileExportHttpError>,
    ) => {
      void handleNativeFileExport(request as AuthenticatedRequest, response, deps);
    },
  );

  return router;
}

export async function exportNativeFileFromRoom(
  db: PrismaClient,
  syncRooms: Map<string, SyncRoom> | undefined,
  roomId: string,
  user: AppUser | undefined,
): Promise<NativeFileExportResponse> {
  if (!user) {
    throw new NativeFileExportError(
      'native-file/unauthenticated',
      'Authentication is required to export a saved document.',
    );
  }

  await resolveRoomAccess(db, roomId, user);
  const roomName = await loadRoomName(db, roomId);
  const syncRoom = await getOrCreateSyncRoom(db, syncRooms ?? new Map(), roomId);
  const snapshot = syncRoom.getStateSnapshot();
  const elements = [...snapshot.elements.values()];

  return {
    document: {
      kind: NATIVE_FILE_KIND,
      schemaVersion: NATIVE_FILE_SCHEMA_VERSION,
      room: {
        id: roomId,
        name: roomName,
        source: 'saved',
        exportedAt: new Date().toISOString(),
      },
      camera: { x: 0, y: 0, zoom: 1 },
      elements,
      assets: collectAssetMetadata(elements),
    },
    documentClock: snapshot.documentClock.toString(),
  };
}

class NativeFileExportError extends Error {
  constructor(
    public readonly code: NativeFileExportHttpError['error']['code'],
    message: string,
  ) {
    super(message);
    this.name = 'NativeFileExportError';
  }
}

async function handleNativeFileExport(
  request: AuthenticatedRequest,
  response: Response<NativeFileExportResponse | NativeFileExportHttpError>,
  deps: NativeFileExportDeps,
): Promise<void> {
  try {
    response.json(
      await exportNativeFileFromRoom(
        deps.db,
        deps.syncRooms,
        readRoomId(request),
        request.auth.user,
      ),
    );
  } catch (error) {
    sendKnownExportError(response, error);
  }
}

async function loadRoomName(db: PrismaClient, roomId: string): Promise<string | null> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { name: true },
  });
  return room?.name ?? null;
}

function collectAssetMetadata(
  elements: NativeFileDocument['elements'],
): NativeFileDocument['assets'] {
  const assets = elements
    .filter((element) => element.type === 'image' && typeof element.props.src === 'string')
    .map((element) => ({
      id: element.id,
      src: element.props.src,
    }));
  return assets;
}

function readRoomId(request: Request): string {
  const value = request.params.roomId;
  return typeof value === 'string' ? value : '';
}

function sendKnownExportError(response: Response<NativeFileExportHttpError>, error: unknown): void {
  if (error instanceof NativeFileExportError) {
    response.status(error.code === 'native-file/unauthenticated' ? 401 : 403).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  if (error instanceof RoomAccessError) {
    response.status(403).json({
      error: {
        code: 'native-file/forbidden',
        message: error.message,
      },
    });
    return;
  }

  throw error;
}
