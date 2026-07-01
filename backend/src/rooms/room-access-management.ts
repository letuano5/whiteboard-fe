import type { PrismaClient } from '@prisma/client';
import {
  ROOM_CAPACITY_LIMITS,
  type RoomAccessMode,
  type RoomAccessPayload,
  type RoomRole,
} from '@vdt/shared';
import type { AppUser } from '../auth/index.js';
import { normalizeEmail } from './room-access-records.js';
import { loadRoomForOwnerAction, resolveRoomAccess, RoomAccessError } from './room-roles.js';

export async function updateRoomMemberRole(
  db: PrismaClient,
  roomId: string,
  actor: AppUser | undefined,
  targetUserId: string,
  role: RoomRole,
): Promise<RoomAccessPayload> {
  if (!actor) {
    throw new RoomAccessError('room-access/unauthenticated', 'Authentication is required.');
  }

  if (role === 'owner') {
    throw new RoomAccessError('room-access/invalid-role', 'Owner transfer is not supported yet.');
  }

  const room = await loadRoomForOwnerAction(db, roomId, actor);
  const target = room.members.find((member) => member.userId === targetUserId);
  if (!target || target.userId === room.ownerId || target.userId === actor.id) {
    throw new RoomAccessError('room-access/member-not-found', 'Room member was not found.');
  }

  await db.roomMember.update({
    where: {
      roomId_userId: {
        roomId,
        userId: targetUserId,
      },
    },
    data: { role },
  });

  return resolveRoomAccess(db, roomId, actor);
}

export async function removeRoomMember(
  db: PrismaClient,
  roomId: string,
  actor: AppUser | undefined,
  targetUserId: string,
): Promise<RoomAccessPayload> {
  if (!actor) {
    throw new RoomAccessError('room-access/unauthenticated', 'Authentication is required.');
  }

  const room = await loadRoomForOwnerAction(db, roomId, actor);
  const target = room.members.find((member) => member.userId === targetUserId);
  if (!target || target.userId === room.ownerId || target.userId === actor.id) {
    throw new RoomAccessError('room-access/member-not-found', 'Room member was not found.');
  }

  await db.roomMember.delete({
    where: {
      roomId_userId: {
        roomId,
        userId: targetUserId,
      },
    },
  });

  return resolveRoomAccess(db, roomId, actor);
}

export async function inviteRoomUser(
  db: PrismaClient,
  roomId: string,
  actor: AppUser | undefined,
  email: string,
  role: Extract<RoomRole, 'editor' | 'viewer'>,
): Promise<RoomAccessPayload> {
  if (!actor) {
    throw new RoomAccessError('room-access/unauthenticated', 'Authentication is required.');
  }

  await loadRoomForOwnerAction(db, roomId, actor);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new RoomAccessError('room-access/invalid-role', 'Invitation email is invalid.');
  }

  const existingUser = await db.appUser.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    select: { id: true },
  });

  if (!existingUser) {
    throw new RoomAccessError(
      'room-access/user-not-found',
      'No user with that email exists in this workspace.',
    );
  }

  await db.roomMember.upsert({
    where: { roomId_userId: { roomId, userId: existingUser.id } },
    create: { roomId, userId: existingUser.id, role },
    update: { role },
  });

  return resolveRoomAccess(db, roomId, actor);
}

export async function revokeRoomInvitation(
  db: PrismaClient,
  roomId: string,
  actor: AppUser | undefined,
  invitationId: string,
): Promise<RoomAccessPayload> {
  if (!actor) {
    throw new RoomAccessError('room-access/unauthenticated', 'Authentication is required.');
  }

  await loadRoomForOwnerAction(db, roomId, actor);
  const invitation = await db.roomInvitation.findFirst({
    where: { id: invitationId, roomId, revokedAt: null, claimedAt: null },
    select: { id: true },
  });
  if (!invitation) {
    throw new RoomAccessError('room-access/invitation-not-found', 'Invitation was not found.');
  }

  await db.roomInvitation.update({
    where: { id: invitationId },
    data: { revokedAt: new Date() },
  });

  return resolveRoomAccess(db, roomId, actor);
}

export async function updateRoomShareMode(
  db: PrismaClient,
  roomId: string,
  actor: AppUser | undefined,
  mode: RoomAccessMode,
): Promise<RoomAccessPayload> {
  if (!actor) {
    throw new RoomAccessError('room-access/unauthenticated', 'Authentication is required.');
  }

  await loadRoomForOwnerAction(db, roomId, actor);
  await db.room.update({
    where: { id: roomId },
    data: {
      visibility: mode,
      shareRevokedAt: null,
    },
  });

  return resolveRoomAccess(db, roomId, actor);
}

export async function revokeRoomShareLink(
  db: PrismaClient,
  roomId: string,
  actor: AppUser | undefined,
): Promise<RoomAccessPayload> {
  if (!actor) {
    throw new RoomAccessError('room-access/unauthenticated', 'Authentication is required.');
  }

  await loadRoomForOwnerAction(db, roomId, actor);
  await db.room.update({
    where: { id: roomId },
    data: {
      visibility: 'private',
      shareRevokedAt: new Date(),
    },
  });

  return resolveRoomAccess(db, roomId, actor);
}

export interface RoomCapacitySettingsInput {
  maxParticipants?: number | null;
  maxEditors?: number | null;
}

export async function updateRoomCapacitySettings(
  db: PrismaClient,
  roomId: string,
  actor: AppUser | undefined,
  input: RoomCapacitySettingsInput,
): Promise<RoomAccessPayload> {
  if (!actor) {
    throw new RoomAccessError('room-access/unauthenticated', 'Authentication is required.');
  }

  const room = await loadRoomForOwnerAction(db, roomId, actor);
  const nextMaxParticipants =
    input.maxParticipants !== undefined ? input.maxParticipants : room.maxParticipants;
  const nextMaxEditors = input.maxEditors !== undefined ? input.maxEditors : room.maxEditors;
  validateCapacitySettings(nextMaxParticipants, nextMaxEditors);

  const roomDelegate = db.room as unknown as {
    update: (args: { where: { id: string }; data: RoomCapacitySettingsInput }) => Promise<unknown>;
  };
  const data: RoomCapacitySettingsInput = {};
  if (input.maxParticipants !== undefined) data.maxParticipants = input.maxParticipants;
  if (input.maxEditors !== undefined) data.maxEditors = input.maxEditors;

  await roomDelegate.update({
    where: { id: roomId },
    data,
  });

  return resolveRoomAccess(db, roomId, actor);
}

function validateCapacitySettings(maxParticipants: number | null, maxEditors: number | null): void {
  if (maxParticipants !== null && maxParticipants > ROOM_CAPACITY_LIMITS.MAX_PARTICIPANTS) {
    throw new RoomAccessError(
      'room-access/invalid-capacity',
      `Participant limit cannot exceed ${ROOM_CAPACITY_LIMITS.MAX_PARTICIPANTS}.`,
    );
  }

  if (maxEditors !== null && maxEditors > ROOM_CAPACITY_LIMITS.MAX_EDITORS) {
    throw new RoomAccessError(
      'room-access/invalid-capacity',
      `Editor limit cannot exceed ${ROOM_CAPACITY_LIMITS.MAX_EDITORS}.`,
    );
  }

  if (maxParticipants !== null && maxEditors !== null && maxEditors > maxParticipants) {
    throw new RoomAccessError(
      'room-access/invalid-capacity',
      'Editor limit cannot exceed participant limit.',
    );
  }
}
