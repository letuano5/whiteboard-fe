import type { PrismaClient } from '@prisma/client';
import type {
  EffectiveRoomRole,
  RoomAccessMode,
  RoomAccessPayload,
  RoomInvitationSummary,
  RoomMemberSummary,
  RoomRole,
} from '@vdt/shared';
import type { AppUser } from '../auth/index.js';
import {
  hasSharingDelegate,
  loadRoomWithAccess,
  makeLegacyEphemeralRoom,
  normalizeEmail,
  type RoomAccessRecord,
  type RoomInvitationRecord,
} from './room-access-records.js';

export function isRoomRole(value: string): value is RoomRole {
  return value === 'owner' || value === 'editor' || value === 'viewer';
}

export function isRoomAccessMode(value: string): value is RoomAccessMode {
  return (
    value === 'private' || value === 'link_view' || value === 'link_edit' || value === 'public_view'
  );
}

export function canMutateRoom(role: EffectiveRoomRole): boolean {
  return role === 'owner' || role === 'editor';
}

export async function resolveRoomAccess(
  db: PrismaClient,
  roomId: string,
  user: AppUser | undefined,
): Promise<RoomAccessPayload> {
  if (!user && !hasSharingDelegate(db)) {
    return toAccessPayload(makeLegacyEphemeralRoom(roomId), 'editor', 'editor');
  }

  let room = await loadRoomWithAccess(db, roomId);

  if (user) {
    const claimed = await claimPendingInvitation(db, room, user);
    if (claimed) {
      room = await loadRoomWithAccess(db, roomId);
    }
  }

  const { baseRole, fromLink } = resolveBaseRole(room, user);
  if (baseRole === 'none') {
    throw new RoomAccessError('room-access/forbidden', 'Room access denied.');
  }

  return toAccessPayload(room, baseRole, resolveEffectiveRole(room, baseRole, fromLink));
}

export async function loadRoomForOwnerAction(
  db: PrismaClient,
  roomId: string,
  actor: AppUser,
): Promise<RoomAccessRecord> {
  const room = await loadRoomWithAccess(db, roomId);
  if (room.ownerId !== actor.id) {
    throw new RoomAccessError('room-access/forbidden', 'Only room owners can change roles.');
  }
  return room;
}

export class RoomAccessError extends Error {
  constructor(
    public readonly code:
      | 'room-access/unauthenticated'
      | 'room-access/forbidden'
      | 'room-access/member-not-found'
      | 'room-access/invitation-not-found'
      | 'room-access/invalid-role',
    message: string,
  ) {
    super(message);
    this.name = 'RoomAccessError';
  }
}

async function claimPendingInvitation(
  db: PrismaClient,
  room: RoomAccessRecord,
  user: AppUser,
): Promise<boolean> {
  const email = normalizeEmail(user.email);
  if (!email) return false;

  const invitation = room.invitations.find((item) => item.email === email);
  if (!invitation) return false;

  await db.roomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId: user.id } },
    create: { roomId: room.id, userId: user.id, role: normalizeEditableRole(invitation.role) },
    update: { role: normalizeEditableRole(invitation.role) },
  });
  await db.roomInvitation.update({
    where: { id: invitation.id },
    data: {
      claimedBy: user.id,
      claimedAt: new Date(),
    },
  });

  return true;
}

function resolveBaseRole(
  room: RoomAccessRecord,
  user: AppUser | undefined,
): { baseRole: EffectiveRoomRole; fromLink: boolean } {
  if (user && room.ownerId === user.id) {
    return { baseRole: 'owner', fromLink: false };
  }

  if (user) {
    const memberRole = room.members.find((member) => member.userId === user.id)?.role;
    if (memberRole && isRoomRole(memberRole)) {
      return { baseRole: memberRole, fromLink: false };
    }
  }

  const visibility = normalizeVisibility(room.visibility);
  if (visibility === 'link_view' || visibility === 'public_view') {
    return { baseRole: 'viewer', fromLink: true };
  }
  if (visibility === 'link_edit') {
    return { baseRole: 'editor', fromLink: true };
  }

  return { baseRole: 'none', fromLink: false };
}

function resolveEffectiveRole(
  room: RoomAccessRecord,
  baseRole: EffectiveRoomRole,
  fromLink: boolean,
): EffectiveRoomRole {
  if (fromLink && baseRole === 'editor' && room.locked) {
    return 'viewer';
  }
  return baseRole;
}

function toAccessPayload(
  room: RoomAccessRecord,
  baseRole: EffectiveRoomRole,
  effectiveRole: EffectiveRoomRole,
): RoomAccessPayload {
  return {
    roomId: room.id,
    role: legacyRole(effectiveRole),
    baseRole,
    effectiveRole,
    visibility: normalizeVisibility(room.visibility),
    shareRevokedAt: room.shareRevokedAt?.toISOString() ?? null,
    members: summarizeMembers(room),
    invitations: summarizeInvitations(room.invitations),
  };
}

function summarizeMembers(room: RoomAccessRecord): RoomMemberSummary[] {
  return room.members
    .map((member) => ({
      userId: member.userId,
      email: member.user.email,
      name: member.user.name,
      avatarUrl: member.user.avatarUrl,
      role: room.ownerId === member.userId ? 'owner' : normalizeRole(member.role),
    }))
    .sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.userId.localeCompare(b.userId));
}

function summarizeInvitations(invitations: RoomInvitationRecord[]): RoomInvitationSummary[] {
  return invitations
    .map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: normalizeEditableRole(invitation.role),
      status: 'pending' as const,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

function normalizeRole(value: string): RoomRole {
  return isRoomRole(value) ? value : 'viewer';
}

function normalizeEditableRole(value: string): Extract<RoomRole, 'editor' | 'viewer'> {
  return value === 'editor' ? 'editor' : 'viewer';
}

function normalizeVisibility(value: string): RoomAccessMode {
  return isRoomAccessMode(value) ? value : 'private';
}

function legacyRole(role: EffectiveRoomRole): RoomRole {
  return role === 'none' ? 'viewer' : role;
}

function roleRank(role: RoomRole): number {
  if (role === 'owner') return 0;
  if (role === 'editor') return 1;
  return 2;
}
