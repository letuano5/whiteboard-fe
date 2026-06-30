import type { PrismaClient } from '@prisma/client';
import type { RoomAccessPayload, RoomMemberSummary, RoomRole } from '@vdt/shared';
import type { AppUser } from '../auth/index.js';

type RoomWithMembers = Awaited<ReturnType<typeof loadRoomWithMembers>>;

const ROOM_WITH_MEMBERS_INCLUDE = {
  members: {
    include: {
      user: true,
    },
  },
} as const;

export function isRoomRole(value: string): value is RoomRole {
  return value === 'owner' || value === 'editor' || value === 'viewer';
}

export function canMutateRoom(role: RoomRole): boolean {
  return role === 'owner' || role === 'editor';
}

export async function resolveRoomAccess(
  db: PrismaClient,
  roomId: string,
  user: AppUser | undefined,
): Promise<RoomAccessPayload> {
  if (!user) {
    return {
      roomId,
      role: 'editor',
      members: [],
    };
  }

  const room = await ensureRoomMembership(db, roomId, user);
  const role = getUserRole(room, user.id);

  return {
    roomId,
    role,
    members: summarizeMembers(room),
  };
}

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

  const room = await ensureRoomMembership(db, roomId, actor);
  if (getUserRole(room, actor.id) !== 'owner') {
    throw new RoomAccessError('room-access/forbidden', 'Only room owners can change roles.');
  }

  const target = room.members.find((member) => member.userId === targetUserId);
  if (!target || target.userId === room.ownerId) {
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

export class RoomAccessError extends Error {
  constructor(
    public readonly code:
      | 'room-access/unauthenticated'
      | 'room-access/forbidden'
      | 'room-access/member-not-found'
      | 'room-access/invalid-role',
    message: string,
  ) {
    super(message);
    this.name = 'RoomAccessError';
  }
}

async function ensureRoomMembership(db: PrismaClient, roomId: string, user: AppUser) {
  const room = await db.room.upsert({
    where: { id: roomId },
    create: {
      id: roomId,
      ownerId: user.id,
      members: {
        create: {
          userId: user.id,
          role: 'owner',
        },
      },
    },
    update: {},
    include: ROOM_WITH_MEMBERS_INCLUDE,
  });

  if (!room.ownerId && room.members.length === 0) {
    await db.room.update({
      where: { id: roomId },
      data: { ownerId: user.id },
    });
    await db.roomMember.upsert({
      where: { roomId_userId: { roomId, userId: user.id } },
      create: { roomId, userId: user.id, role: 'owner' },
      update: { role: 'owner' },
    });
    return loadRoomWithMembers(db, roomId);
  }

  if (room.ownerId === user.id) {
    const ownerMember = room.members.find((member) => member.userId === user.id);
    if (ownerMember?.role !== 'owner') {
      await db.roomMember.upsert({
        where: { roomId_userId: { roomId, userId: user.id } },
        create: { roomId, userId: user.id, role: 'owner' },
        update: { role: 'owner' },
      });
      return loadRoomWithMembers(db, roomId);
    }
  }

  if (!room.members.some((member) => member.userId === user.id)) {
    await db.roomMember.create({
      data: {
        roomId,
        userId: user.id,
        role: 'viewer',
      },
    });
    return loadRoomWithMembers(db, roomId);
  }

  return room;
}

async function loadRoomWithMembers(db: PrismaClient, roomId: string) {
  const room = await db.room.findUniqueOrThrow({
    where: { id: roomId },
    include: ROOM_WITH_MEMBERS_INCLUDE,
  });

  return room;
}

function getUserRole(room: RoomWithMembers, userId: string): RoomRole {
  if (room.ownerId === userId) {
    return 'owner';
  }

  const role = room.members.find((member) => member.userId === userId)?.role;
  return role && isRoomRole(role) ? role : 'viewer';
}

function summarizeMembers(room: RoomWithMembers): RoomMemberSummary[] {
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

function normalizeRole(value: string): RoomRole {
  return isRoomRole(value) ? value : 'viewer';
}

function roleRank(role: RoomRole): number {
  if (role === 'owner') return 0;
  if (role === 'editor') return 1;
  return 2;
}
