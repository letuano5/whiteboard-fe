import type { PrismaClient } from '@prisma/client';
import type {
  EffectiveRoomRole,
  Presence,
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
  RoomNotFoundError,
  type RoomAccessRecord,
  type RoomInvitationRecord,
} from './room-access-records.js';

export function isRoomRole(value: string): value is RoomRole {
  return value === 'owner' || value === 'editor' || value === 'viewer';
}

export function isRoomAccessMode(value: string): value is RoomAccessMode {
  return value === 'private' || value === 'link_view' || value === 'link_edit';
}

export function canMutateRoom(role: EffectiveRoomRole): boolean {
  return role === 'owner' || role === 'editor';
}

export async function resolveRoomAccess(
  db: PrismaClient,
  roomId: string,
  user: AppUser | undefined,
  options: ResolveRoomAccessOptions = {},
): Promise<RoomAccessPayload> {
  if (!user && !hasSharingDelegate(db)) {
    return toAccessPayload(makeLegacyEphemeralRoom(roomId), 'editor', 'editor');
  }

  const room = await loadRoom(db, roomId);

  const { baseRole } = resolveBaseRole(room, user);
  if (baseRole === 'none') {
    throw new RoomAccessError('room-access/forbidden', 'Room access denied.');
  }

  enforceParticipantLimit(room, options);
  return toAccessPayload(room, baseRole, resolveEffectiveRole(room, baseRole, options));
}

export async function loadRoomForOwnerAction(
  db: PrismaClient,
  roomId: string,
  actor: AppUser,
): Promise<RoomAccessRecord> {
  const room = await loadRoom(db, roomId);
  if (room.ownerId !== actor.id) {
    throw new RoomAccessError('room-access/forbidden', 'Only room owners can change roles.');
  }
  return room;
}

async function loadRoom(db: PrismaClient, roomId: string): Promise<RoomAccessRecord> {
  try {
    return await loadRoomWithAccess(db, roomId);
  } catch (err) {
    if (err instanceof RoomNotFoundError) {
      throw new RoomAccessError('room-access/forbidden', 'Room access denied.');
    }
    throw err;
  }
}

export class RoomAccessError extends Error {
  constructor(
    public readonly code:
      | 'room-access/unauthenticated'
      | 'room-access/forbidden'
      | 'room-access/user-not-found'
      | 'room-access/member-not-found'
      | 'room-access/invitation-not-found'
      | 'room-access/invalid-role'
      | 'room-access/invalid-capacity'
      | 'room-access/room-full',
    message: string,
  ) {
    super(message);
    this.name = 'RoomAccessError';
  }
}

interface ResolveRoomAccessOptions {
  activePresences?: Iterable<Presence>;
  currentSessionId?: string;
}

function resolveBaseRole(
  room: RoomAccessRecord,
  user: AppUser | undefined,
): { baseRole: EffectiveRoomRole; fromLink: boolean } {
  if (user && room.ownerId === user.id) {
    return { baseRole: 'owner', fromLink: false };
  }

  const linkRole = resolveLinkRole(room);
  let memberRole: EffectiveRoomRole = 'none';
  if (user) {
    const role = room.members.find((member) => member.userId === user.id)?.role;
    if (role && isRoomRole(role)) {
      memberRole = role;
    }
  }

  const baseRole = strongerRoomRole(memberRole, linkRole);
  return { baseRole, fromLink: roleRankValue(linkRole) > roleRankValue(memberRole) };
}

function resolveLinkRole(room: RoomAccessRecord): EffectiveRoomRole {
  const visibility = normalizeVisibility(room.visibility);
  if (visibility === 'link_view') {
    return 'viewer';
  }
  if (visibility === 'link_edit') {
    return 'editor';
  }

  return 'none';
}

function strongerRoomRole(left: EffectiveRoomRole, right: EffectiveRoomRole): EffectiveRoomRole {
  return roleRankValue(left) >= roleRankValue(right) ? left : right;
}

function roleRankValue(role: EffectiveRoomRole): number {
  if (role === 'owner') return 3;
  if (role === 'editor') return 2;
  if (role === 'viewer') return 1;
  return 0;
}

function resolveEffectiveRole(
  room: RoomAccessRecord,
  baseRole: EffectiveRoomRole,
  options: ResolveRoomAccessOptions,
): EffectiveRoomRole {
  if (baseRole === 'editor' && isEditorLimitFull(room, options)) {
    return 'viewer';
  }
  return baseRole;
}

function enforceParticipantLimit(room: RoomAccessRecord, options: ResolveRoomAccessOptions): void {
  if (!room.maxParticipants) return;
  const activeCount = getActivePresences(options).length;
  if (activeCount >= room.maxParticipants) {
    throw new RoomAccessError('room-access/room-full', 'Room participant limit reached.');
  }
}

function isEditorLimitFull(room: RoomAccessRecord, options: ResolveRoomAccessOptions): boolean {
  if (!room.maxEditors) return false;
  const activeEditorCount = getActivePresences(options).filter(
    (presence) => presence.effectiveRole === 'editor',
  ).length;
  return activeEditorCount >= room.maxEditors;
}

function getActivePresences(options: ResolveRoomAccessOptions): Presence[] {
  const presences = [...(options.activePresences ?? [])];
  if (!options.currentSessionId) return presences;
  return presences.filter((presence) => presence.sessionId !== options.currentSessionId);
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
    maxParticipants: room.maxParticipants,
    maxEditors: room.maxEditors,
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
