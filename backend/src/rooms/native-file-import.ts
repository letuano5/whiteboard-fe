import type { Request, Response, Router } from 'express';
import express from 'express';
import type { PrismaClient } from '@prisma/client';
import {
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
import { saveRoomElements } from '../persistence/room-repository.js';
import { canMutateRoom, resolveRoomAccess, RoomAccessError } from './room-roles.js';

interface NativeFileImportDeps {
  authVerifier: AuthVerifier;
  appUserRepository: AppUserRepository;
  db: PrismaClient;
}

interface NativeFileImportPayload {
  document: NativeFileDocument;
  mode: NativeFileImportMode;
}

interface NativeFileImportResponse {
  importedElementCount: number;
  documentClock: string | null;
}

interface NativeFileImportHttpError {
  error: {
    code: 'native-file/unauthenticated' | 'native-file/forbidden' | 'native-file/invalid-payload';
    message: string;
  };
}

export function createNativeFileImportRouter(deps: NativeFileImportDeps): Router {
  const router = express.Router();
  router.use(express.json({ limit: '10mb' }));
  router.use(
    createHttpAuthMiddleware(deps.authVerifier, {
      appUserRepository: deps.appUserRepository,
    }),
  );

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

  const result = await saveRoomElements(db, roomId, document.elements);
  return {
    importedElementCount: document.elements.length,
    documentClock: result?.documentClock.toString() ?? null,
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
  const payload = readNativeFileImportPayload(request.body);
  if (!payload) {
    sendNativeFileError(response, 400, 'native-file/invalid-payload', 'Native file is invalid.');
    return;
  }

  try {
    response.json(
      await importNativeFileIntoRoom(
        deps.db,
        readRoomId(request),
        request.auth.user,
        payload.document,
      ),
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
