import type { Request, Response, Router } from 'express';
import express from 'express';
import type { PrismaClient } from '@prisma/client';
import {
  ROOM_CAPACITY_LIMITS,
  type RoomAccessMode,
  type RoomAccessPayload,
  type RoomRole,
} from '@vdt/shared';
import type { AuthVerifier } from '../auth/index.js';
import {
  createHttpAuthMiddleware,
  type AppUserRepository,
  type AuthenticatedRequest,
} from '../auth/index.js';
import {
  inviteRoomUser,
  removeRoomMember,
  revokeRoomInvitation,
  revokeRoomShareLink,
  updateRoomCapacitySettings,
  type RoomCapacitySettingsInput,
  updateRoomMemberRole,
  updateRoomShareMode,
} from './room-access-management.js';
import { isRoomAccessMode, resolveRoomAccess, RoomAccessError } from './room-roles.js';

interface RoomSharingDeps {
  authVerifier: AuthVerifier;
  appUserRepository: AppUserRepository;
  db: PrismaClient;
}

interface RoomAccessHttpError {
  error: {
    code:
      | 'room-access/unauthenticated'
      | 'room-access/forbidden'
      | 'room-access/user-not-found'
      | 'room-access/member-not-found'
      | 'room-access/invitation-not-found'
      | 'room-access/invalid-role'
      | 'room-access/invalid-capacity'
      | 'room-access/room-full'
      | 'room-access/invalid-payload';
    message: string;
  };
}

export function createRoomSharingRouter(deps: RoomSharingDeps): Router {
  const router = express.Router();
  router.use(express.json({ limit: '1mb' }));
  router.use(
    createHttpAuthMiddleware(deps.authVerifier, {
      appUserRepository: deps.appUserRepository,
    }),
  );

  router.get(
    '/api/rooms/:roomId/access',
    (request: Request, response: Response<RoomAccessPayload | RoomAccessHttpError>) => {
      void handleAccessSummary(request as AuthenticatedRequest, response, deps);
    },
  );
  router.put(
    '/api/rooms/:roomId/share',
    (request: Request, response: Response<RoomAccessPayload | RoomAccessHttpError>) => {
      void handleUpdateShareMode(request as AuthenticatedRequest, response, deps);
    },
  );
  router.delete(
    '/api/rooms/:roomId/share',
    (request: Request, response: Response<RoomAccessPayload | RoomAccessHttpError>) => {
      void handleRevokeShareLink(request as AuthenticatedRequest, response, deps);
    },
  );
  router.patch(
    '/api/rooms/:roomId/capacity',
    (request: Request, response: Response<RoomAccessPayload | RoomAccessHttpError>) => {
      void handleUpdateRoomCapacity(request as AuthenticatedRequest, response, deps);
    },
  );
  router.post(
    '/api/rooms/:roomId/invitations',
    (request: Request, response: Response<RoomAccessPayload | RoomAccessHttpError>) => {
      void handleInviteUser(request as AuthenticatedRequest, response, deps);
    },
  );
  router.delete(
    '/api/rooms/:roomId/invitations/:invitationId',
    (request: Request, response: Response<RoomAccessPayload | RoomAccessHttpError>) => {
      void handleRevokeInvitation(request as AuthenticatedRequest, response, deps);
    },
  );
  router.patch(
    '/api/rooms/:roomId/members/:userId',
    (request: Request, response: Response<RoomAccessPayload | RoomAccessHttpError>) => {
      void handleUpdateMemberRole(request as AuthenticatedRequest, response, deps);
    },
  );
  router.delete(
    '/api/rooms/:roomId/members/:userId',
    (request: Request, response: Response<RoomAccessPayload | RoomAccessHttpError>) => {
      void handleRemoveMember(request as AuthenticatedRequest, response, deps);
    },
  );

  return router;
}

async function handleUpdateRoomCapacity(
  request: AuthenticatedRequest,
  response: Response<RoomAccessPayload | RoomAccessHttpError>,
  deps: RoomSharingDeps,
): Promise<void> {
  const input = readRoomCapacityInput(request.body);
  if (!input) {
    sendAccessError(response, 400, 'room-access/invalid-payload', 'Room capacity is invalid.');
    return;
  }

  try {
    response.json(
      await updateRoomCapacitySettings(deps.db, readRoomId(request), request.auth.user, input),
    );
  } catch (error) {
    sendKnownAccessError(response, error);
  }
}

async function handleAccessSummary(
  request: AuthenticatedRequest,
  response: Response<RoomAccessPayload | RoomAccessHttpError>,
  deps: RoomSharingDeps,
): Promise<void> {
  try {
    response.json(await resolveRoomAccess(deps.db, readRoomId(request), request.auth.user));
  } catch (error) {
    sendKnownAccessError(response, error);
  }
}

async function handleUpdateShareMode(
  request: AuthenticatedRequest,
  response: Response<RoomAccessPayload | RoomAccessHttpError>,
  deps: RoomSharingDeps,
): Promise<void> {
  const mode = readShareMode(request.body);
  if (!mode) {
    sendAccessError(response, 400, 'room-access/invalid-payload', 'Share mode is invalid.');
    return;
  }

  try {
    response.json(await updateRoomShareMode(deps.db, readRoomId(request), request.auth.user, mode));
  } catch (error) {
    sendKnownAccessError(response, error);
  }
}

async function handleRevokeShareLink(
  request: AuthenticatedRequest,
  response: Response<RoomAccessPayload | RoomAccessHttpError>,
  deps: RoomSharingDeps,
): Promise<void> {
  try {
    response.json(await revokeRoomShareLink(deps.db, readRoomId(request), request.auth.user));
  } catch (error) {
    sendKnownAccessError(response, error);
  }
}

async function handleInviteUser(
  request: AuthenticatedRequest,
  response: Response<RoomAccessPayload | RoomAccessHttpError>,
  deps: RoomSharingDeps,
): Promise<void> {
  const input = readInviteInput(request.body);
  if (!input) {
    sendAccessError(response, 400, 'room-access/invalid-payload', 'Invitation payload is invalid.');
    return;
  }

  try {
    response
      .status(201)
      .json(
        await inviteRoomUser(
          deps.db,
          readRoomId(request),
          request.auth.user,
          input.email,
          input.role,
        ),
      );
  } catch (error) {
    sendKnownAccessError(response, error);
  }
}

async function handleRevokeInvitation(
  request: AuthenticatedRequest,
  response: Response<RoomAccessPayload | RoomAccessHttpError>,
  deps: RoomSharingDeps,
): Promise<void> {
  try {
    response.json(
      await revokeRoomInvitation(
        deps.db,
        readRoomId(request),
        request.auth.user,
        readInvitationId(request),
      ),
    );
  } catch (error) {
    sendKnownAccessError(response, error);
  }
}

async function handleUpdateMemberRole(
  request: AuthenticatedRequest,
  response: Response<RoomAccessPayload | RoomAccessHttpError>,
  deps: RoomSharingDeps,
): Promise<void> {
  const role = readEditableRole(request.body);
  if (!role) {
    sendAccessError(response, 400, 'room-access/invalid-payload', 'Role is invalid.');
    return;
  }

  try {
    response.json(
      await updateRoomMemberRole(
        deps.db,
        readRoomId(request),
        request.auth.user,
        readUserId(request),
        role,
      ),
    );
  } catch (error) {
    sendKnownAccessError(response, error);
  }
}

async function handleRemoveMember(
  request: AuthenticatedRequest,
  response: Response<RoomAccessPayload | RoomAccessHttpError>,
  deps: RoomSharingDeps,
): Promise<void> {
  try {
    response.json(
      await removeRoomMember(deps.db, readRoomId(request), request.auth.user, readUserId(request)),
    );
  } catch (error) {
    sendKnownAccessError(response, error);
  }
}

function readShareMode(value: unknown): RoomAccessMode | null {
  if (typeof value !== 'object' || value === null) return null;
  const mode = (value as Record<string, unknown>).mode;
  return typeof mode === 'string' && isRoomAccessMode(mode) ? mode : null;
}

function readInviteInput(
  value: unknown,
): { email: string; role: Extract<RoomRole, 'editor' | 'viewer'> } | null {
  if (typeof value !== 'object' || value === null) return null;
  const body = value as Record<string, unknown>;
  const role = body.role;
  if (typeof body.email !== 'string') return null;
  if (role !== 'editor' && role !== 'viewer') return null;
  return { email: body.email, role };
}

function readEditableRole(value: unknown): Extract<RoomRole, 'editor' | 'viewer'> | null {
  if (typeof value !== 'object' || value === null) return null;
  const role = (value as Record<string, unknown>).role;
  return role === 'editor' || role === 'viewer' ? role : null;
}

function readRoomCapacityInput(value: unknown): RoomCapacitySettingsInput | null {
  if (typeof value !== 'object' || value === null) return null;
  const body = value as Record<string, unknown>;
  const input: RoomCapacitySettingsInput = {};
  const keys = Object.keys(body);
  if (keys.some((key) => key !== 'maxParticipants' && key !== 'maxEditors')) return null;

  if ('maxParticipants' in body) {
    const limit = readOptionalCapacityLimit(
      body.maxParticipants,
      ROOM_CAPACITY_LIMITS.MAX_PARTICIPANTS,
    );
    if (limit === undefined) return null;
    input.maxParticipants = limit;
  }
  if ('maxEditors' in body) {
    const limit = readOptionalCapacityLimit(body.maxEditors, ROOM_CAPACITY_LIMITS.MAX_EDITORS);
    if (limit === undefined) return null;
    input.maxEditors = limit;
  }

  return Object.keys(input).length > 0 ? input : null;
}

function readOptionalCapacityLimit(value: unknown, maxValue: number): number | null | undefined {
  if (value === null) return null;
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= maxValue
    ? value
    : undefined;
}

function readRoomId(request: Request): string {
  return readParam(request.params.roomId);
}

function readUserId(request: Request): string {
  return readParam(request.params.userId);
}

function readInvitationId(request: Request): string {
  return readParam(request.params.invitationId);
}

function readParam(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

function sendKnownAccessError(response: Response<RoomAccessHttpError>, error: unknown): void {
  if (error instanceof RoomAccessError) {
    const status =
      error.code === 'room-access/unauthenticated'
        ? 401
        : error.code === 'room-access/invalid-capacity'
          ? 400
          : 403;
    sendAccessError(response, status, error.code, error.message);
    return;
  }

  throw error;
}

function sendAccessError(
  response: Response<RoomAccessHttpError>,
  status: number,
  code: RoomAccessHttpError['error']['code'],
  message: string,
): void {
  response.status(status).json({ error: { code, message } });
}
