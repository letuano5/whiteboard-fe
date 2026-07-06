import type { Request, Response, Router } from 'express';
import express from 'express';
import type { Server } from 'socket.io';
import { WS_EVENTS } from '@vdt/shared';
import type { AuthVerifier } from '../auth/index.js';
import {
  createHttpAuthMiddleware,
  type AppUser,
  type AppUserRepository,
  type AuthenticatedRequest,
} from '../auth/index.js';
import { deleteSyncRoom, executeReplaceDocument, type SyncRoom } from '../sync/index.js';
import { forgetRoomCache } from '../realtime/room-cache-gc.js';
import { loadRoomForOwnerAction, resolveRoomAccess, RoomAccessError } from './room-roles.js';
import {
  captureRoomSnapshot,
  readSnapshotElements,
  toSnapshotMetadata,
  type RoomSnapshotDb,
  type SnapshotMetadata,
  type SnapshotRecord,
} from './room-snapshots.js';

interface RoomHistoryDeps {
  authVerifier: AuthVerifier;
  appUserRepository: AppUserRepository;
  db: RoomHistoryDb;
  ioServer?: Server;
  syncRooms?: Map<string, SyncRoom>;
  roomElements?: Map<string, unknown>;
  roomClocks?: Map<string, number>;
}

type RoomHistoryDb = RoomSnapshotDb & {
  snapshot: RoomSnapshotDb['snapshot'] & {
    findMany: (args: {
      where: { roomId: string };
      orderBy: { createdAt: 'desc' };
      take: number;
      select: SnapshotSelect;
    }) => Promise<SnapshotRecord[]>;
    findUnique: (args: {
      where: { id: string };
      select: SnapshotSelect & { roomId: true; records: true };
    }) => Promise<(SnapshotRecord & { roomId: string }) | null>;
  };
  record?: {
    create?: (...args: never[]) => Promise<unknown>;
    update?: (...args: never[]) => Promise<unknown>;
    delete?: (...args: never[]) => Promise<unknown>;
    deleteMany?: (...args: never[]) => Promise<unknown>;
    upsert?: (...args: never[]) => Promise<unknown>;
  };
  tombstone?: {
    create?: (...args: never[]) => Promise<unknown>;
    update?: (...args: never[]) => Promise<unknown>;
    delete?: (...args: never[]) => Promise<unknown>;
    deleteMany?: (...args: never[]) => Promise<unknown>;
    upsert?: (...args: never[]) => Promise<unknown>;
  };
};

interface SnapshotSelect {
  id: true;
  documentClock: true;
  roomEpoch: true;
  createdBy: true;
  createdAt: true;
  reason: true;
  tombstones: true;
}

interface RoomHistoryHttpError {
  error: {
    code:
      | 'room-history/unauthenticated'
      | 'room-history/forbidden'
      | 'room-history/not-found'
      | 'room-history/internal-error';
    message: string;
  };
}

interface RestoreSnapshotResponse {
  documentClock: string;
  roomEpoch: number;
  restoredElementCount: number;
}

const SNAPSHOT_LIST_LIMIT = 100;

const SNAPSHOT_METADATA_SELECT = {
  id: true,
  documentClock: true,
  roomEpoch: true,
  createdBy: true,
  createdAt: true,
  reason: true,
  tombstones: true,
} as const;

export function createRoomHistoryRouter(deps: RoomHistoryDeps): Router {
  const router = express.Router();
  router.use(express.json({ limit: '1mb' }));
  router.use(
    createHttpAuthMiddleware(deps.authVerifier, {
      appUserRepository: deps.appUserRepository,
    }),
  );

  router.get(
    '/api/rooms/:roomId/snapshots',
    (request: Request, response: Response<SnapshotMetadata[] | RoomHistoryHttpError>) => {
      void handleListSnapshots(request as AuthenticatedRequest, response, deps);
    },
  );
  router.post(
    '/api/rooms/:roomId/snapshots/:snapshotId/restore',
    (request: Request, response: Response<RestoreSnapshotResponse | RoomHistoryHttpError>) => {
      void handleRestoreSnapshot(request as AuthenticatedRequest, response, deps);
    },
  );

  return router;
}

export async function listRoomSnapshots(
  db: RoomHistoryDb,
  roomId: string,
  user: AppUser | undefined,
): Promise<SnapshotMetadata[]> {
  await assertCanListSnapshots(db, roomId, user);
  const snapshots = await db.snapshot.findMany({
    where: { roomId },
    orderBy: { createdAt: 'desc' },
    take: SNAPSHOT_LIST_LIMIT,
    select: SNAPSHOT_METADATA_SELECT,
  });
  return snapshots.map(toSnapshotMetadata);
}

export async function restoreRoomSnapshot(
  deps: Pick<RoomHistoryDeps, 'db' | 'ioServer' | 'syncRooms' | 'roomElements' | 'roomClocks'>,
  input: {
    roomId: string;
    snapshotId: string;
    user: AppUser | undefined;
  },
): Promise<RestoreSnapshotResponse> {
  if (!input.user) {
    throw new RoomHistoryError(
      'room-history/unauthenticated',
      'Authentication is required to restore a snapshot.',
    );
  }

  await loadRoomForOwnerAction(deps.db as never, input.roomId, input.user);
  const snapshot = await deps.db.snapshot.findUnique({
    where: { id: input.snapshotId },
    select: { ...SNAPSHOT_METADATA_SELECT, roomId: true, records: true },
  });

  if (!snapshot || snapshot.roomId !== input.roomId) {
    throw new RoomHistoryError('room-history/not-found', 'Snapshot was not found.');
  }

  await captureRoomSnapshot(deps.db, {
    roomId: input.roomId,
    reason: 'restore_safety',
    createdBy: input.user.id,
  });

  const elements = readSnapshotElements(snapshot.records);
  const result = await executeReplaceDocument(
    {
      roomId: input.roomId,
      elements,
      reason: 'restore',
    },
    {
      actorId: input.user.id,
      effectiveRole: 'owner',
      db: deps.db as never,
      syncRooms: deps.syncRooms,
    },
  );

  deleteSyncRoom(deps.syncRooms, input.roomId);
  deps.roomElements?.delete(input.roomId);
  deps.roomClocks?.delete(input.roomId);
  forgetRoomCache(deps.roomElements, input.roomId);
  deps.ioServer?.to(input.roomId).emit(WS_EVENTS.ROOM_REPLACED, result.replacePayload);

  return {
    documentClock: result.documentClock,
    roomEpoch: result.roomEpoch,
    restoredElementCount: elements.length,
  };
}

export class RoomHistoryError extends Error {
  constructor(
    public readonly code: RoomHistoryHttpError['error']['code'],
    message: string,
  ) {
    super(message);
    this.name = 'RoomHistoryError';
  }
}

async function assertCanListSnapshots(
  db: RoomHistoryDb,
  roomId: string,
  user: AppUser | undefined,
): Promise<void> {
  if (!user) {
    throw new RoomHistoryError(
      'room-history/unauthenticated',
      'Authentication is required to view snapshots.',
    );
  }
  await resolveRoomAccess(db as never, roomId, user);
}

async function handleListSnapshots(
  request: AuthenticatedRequest,
  response: Response<SnapshotMetadata[] | RoomHistoryHttpError>,
  deps: RoomHistoryDeps,
): Promise<void> {
  try {
    response.json(await listRoomSnapshots(deps.db, readRoomId(request), request.auth.user));
  } catch (error) {
    sendKnownHistoryError(response, error);
  }
}

async function handleRestoreSnapshot(
  request: AuthenticatedRequest,
  response: Response<RestoreSnapshotResponse | RoomHistoryHttpError>,
  deps: RoomHistoryDeps,
): Promise<void> {
  try {
    response.json(
      await restoreRoomSnapshot(deps, {
        roomId: readRoomId(request),
        snapshotId: readSnapshotId(request),
        user: request.auth.user,
      }),
    );
  } catch (error) {
    sendKnownHistoryError(response, error);
  }
}

function sendKnownHistoryError(response: Response<RoomHistoryHttpError>, error: unknown): void {
  if (error instanceof RoomHistoryError) {
    const status = error.code === 'room-history/not-found' ? 404 : errorStatus(error.code);
    sendHistoryError(response, status, error.code, error.message);
    return;
  }

  if (error instanceof RoomAccessError) {
    sendHistoryError(response, 403, 'room-history/forbidden', error.message);
    return;
  }

  console.error('[room-history] Unexpected error:', error);
  sendHistoryError(response, 500, 'room-history/internal-error', 'Failed to process room history.');
}

function sendHistoryError(
  response: Response<RoomHistoryHttpError>,
  status: number,
  code: RoomHistoryHttpError['error']['code'],
  message: string,
): void {
  response.status(status).json({ error: { code, message } });
}

function errorStatus(code: RoomHistoryHttpError['error']['code']): number {
  return code === 'room-history/unauthenticated' ? 401 : 403;
}

function readRoomId(request: Request): string {
  const value = request.params.roomId;
  return typeof value === 'string' ? value : '';
}

function readSnapshotId(request: Request): string {
  const value = request.params.snapshotId;
  return typeof value === 'string' ? value : '';
}
