import type { PrismaClient } from '@prisma/client';

export interface RoomAccessUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export interface RoomMemberRecord {
  roomId: string;
  userId: string;
  role: string;
  user: RoomAccessUser;
}

export interface RoomInvitationRecord {
  id: string;
  roomId: string;
  email: string;
  role: string;
  invitedBy: string;
  claimedBy: string | null;
  claimedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomAccessRecord {
  id: string;
  name: string;
  workspaceId: string | null;
  ownerId: string | null;
  visibility: string;
  shareRevokedAt: Date | null;
  locked: boolean;
  maxParticipants: number | null;
  maxEditors: number | null;
  archivedAt: Date | null;
  lastOpenedAt: Date | null;
  createdBy: string | null;
  documentClock: bigint;
  tombstoneHistoryStartsAtClock: bigint;
  createdAt: Date;
  updatedAt: Date;
  members: RoomMemberRecord[];
  invitations: RoomInvitationRecord[];
}

export const ROOM_ACCESS_INCLUDE = {
  members: {
    include: {
      user: true,
    },
  },
  invitations: {
    where: {
      revokedAt: null,
      claimedAt: null,
    },
  },
} as const;

export async function loadRoomWithAccess(
  db: PrismaClient,
  roomId: string,
): Promise<RoomAccessRecord> {
  const roomDelegate = db.room as unknown as {
    findUnique?: (args: unknown) => Promise<RoomAccessRecord | null>;
    upsert?: (args: unknown) => Promise<RoomAccessRecord>;
  };
  const loaded = roomDelegate.findUnique
    ? await roomDelegate.findUnique({
        where: { id: roomId },
        include: ROOM_ACCESS_INCLUDE,
      })
    : await roomDelegate.upsert?.({
        where: { id: roomId },
        create: { id: roomId },
        update: {},
        include: ROOM_ACCESS_INCLUDE,
      });
  const room =
    loaded && !Array.isArray(loaded.members) && roomDelegate.upsert
      ? await roomDelegate.upsert({
          where: { id: roomId },
          create: { id: roomId },
          update: {},
          include: ROOM_ACCESS_INCLUDE,
        })
      : loaded;

  if (!room) {
    return makeLegacyEphemeralRoom(roomId);
  }

  return normalizeLoadedRoom(room, roomId);
}

export function hasSharingDelegate(db: PrismaClient): boolean {
  return 'roomInvitation' in db;
}

export function normalizeEmail(email: string | null): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

export function makeLegacyEphemeralRoom(roomId: string): RoomAccessRecord {
  return {
    id: roomId,
    name: 'Untitled',
    workspaceId: null,
    ownerId: null,
    visibility: 'link_edit',
    shareRevokedAt: null,
    locked: false,
    maxParticipants: null,
    maxEditors: null,
    archivedAt: null,
    lastOpenedAt: null,
    createdBy: null,
    documentClock: 0n,
    tombstoneHistoryStartsAtClock: 0n,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    members: [],
    invitations: [],
  };
}

function normalizeLoadedRoom(room: Partial<RoomAccessRecord>, roomId: string): RoomAccessRecord {
  if (!Array.isArray(room.members)) {
    return makeLegacyEphemeralRoom(roomId);
  }

  return {
    id: room.id ?? roomId,
    name: room.name ?? 'Untitled',
    workspaceId: room.workspaceId ?? null,
    ownerId: room.ownerId ?? null,
    visibility: room.visibility ?? 'private',
    shareRevokedAt: room.shareRevokedAt ?? null,
    locked: room.locked ?? false,
    maxParticipants: normalizeLimit(room.maxParticipants),
    maxEditors: normalizeLimit(room.maxEditors),
    archivedAt: room.archivedAt ?? null,
    lastOpenedAt: room.lastOpenedAt ?? null,
    createdBy: room.createdBy ?? null,
    documentClock: room.documentClock ?? 0n,
    tombstoneHistoryStartsAtClock: room.tombstoneHistoryStartsAtClock ?? 0n,
    createdAt: room.createdAt ?? new Date(0),
    updatedAt: room.updatedAt ?? new Date(0),
    members: room.members,
    invitations: Array.isArray(room.invitations) ? room.invitations : [],
  };
}

function normalizeLimit(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}
