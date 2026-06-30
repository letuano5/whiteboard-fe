import type { Request, Response, Router } from 'express';
import express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { Camera, Element } from '@vdt/shared';
import type { AuthVerifier } from '../auth/index.js';
import {
  createHttpAuthMiddleware,
  type AppUserRepository,
  type AuthenticatedRequest,
} from '../auth/index.js';
import { saveRoomElements } from '../persistence/room-repository.js';

interface LocalBoardSaveDeps {
  authVerifier: AuthVerifier;
  appUserRepository: AppUserRepository;
  db: PrismaClient;
}

interface LocalBoardSaveResponse {
  roomId: string;
}

interface LocalBoardSaveError {
  error: {
    code: 'local-board/invalid-payload' | 'local-board/unauthenticated';
    message: string;
  };
}

interface LocalBoardSavePayload {
  elements: Element[];
  camera: Camera;
}

export function createLocalBoardSaveRouter(deps: LocalBoardSaveDeps): Router {
  const router = express.Router();
  router.use(express.json({ limit: '10mb' }));
  router.post(
    '/api/rooms/from-local',
    createHttpAuthMiddleware(deps.authVerifier, {
      appUserRepository: deps.appUserRepository,
    }),
    (request: Request, response: Response<LocalBoardSaveResponse | LocalBoardSaveError>) => {
      void handleSaveLocalBoard(request as AuthenticatedRequest, response, deps);
    },
  );

  return router;
}

export async function saveLocalBoardAsRoom(
  db: PrismaClient,
  userId: string,
  elements: Element[],
): Promise<LocalBoardSaveResponse> {
  const room = await db.room.create({
    data: {
      ownerId: userId,
      createdBy: userId,
      visibility: 'private',
      members: {
        create: {
          userId,
          role: 'owner',
        },
      },
    },
    select: { id: true },
  });

  await saveRoomElements(db, room.id, elements, 1);

  return { roomId: room.id };
}

async function handleSaveLocalBoard(
  request: AuthenticatedRequest,
  response: Response<LocalBoardSaveResponse | LocalBoardSaveError>,
  deps: LocalBoardSaveDeps,
): Promise<void> {
  const user = request.auth.user;
  if (!user) {
    response.status(401).json({
      error: {
        code: 'local-board/unauthenticated',
        message: 'Authentication is required to save this board.',
      },
    });
    return;
  }

  if (!isLocalBoardSavePayload(request.body)) {
    response.status(400).json({
      error: {
        code: 'local-board/invalid-payload',
        message: 'Local board payload is invalid.',
      },
    });
    return;
  }

  response.status(201).json(await saveLocalBoardAsRoom(deps.db, user.id, request.body.elements));
}

function isLocalBoardSavePayload(value: unknown): value is LocalBoardSavePayload {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Record<string, unknown>;
  return Array.isArray(payload.elements) && isCamera(payload.camera);
}

function isCamera(value: unknown): value is Camera {
  if (typeof value !== 'object' || value === null) return false;
  const camera = value as Record<string, unknown>;
  return (
    typeof camera.x === 'number' && typeof camera.y === 'number' && typeof camera.zoom === 'number'
  );
}
