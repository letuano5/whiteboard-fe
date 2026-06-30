import type { PrismaClient } from '@prisma/client';
import type {
  DashboardDocument,
  DashboardListFilters,
  DocumentDashboardResponse,
  RoomForDashboard,
} from './types.js';

export class DocumentPermissionError extends Error {
  constructor(
    public readonly code: 'documents/not-found' | 'documents/forbidden',
    message: string,
  ) {
    super(message);
    this.name = 'DocumentPermissionError';
  }
}

export async function listDashboardDocuments(
  db: PrismaClient,
  userId: string,
  filters: DashboardListFilters = {},
): Promise<DocumentDashboardResponse> {
  const rooms = (await db.room.findMany({
    where: buildDashboardWhere(userId, filters),
    include: {
      owner: {
        select: {
          name: true,
          email: true,
        },
      },
      members: {
        where: { userId },
        select: {
          role: true,
          lastOpenedAt: true,
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
  })) as RoomForDashboard[];

  const documents = rooms.map((room) => toDashboardDocument(room, userId));

  return {
    owned: documents.filter((document) => document.ownerId === userId),
    sharedWithMe: documents.filter((document) => document.ownerId !== userId),
    recent: documents
      .filter((document) => document.lastOpenedAt)
      .sort((a, b) => compareNullableIsoDesc(a.lastOpenedAt, b.lastOpenedAt)),
  };
}

export async function createDashboardDocument(
  db: PrismaClient,
  userId: string,
  name = 'Untitled',
): Promise<{ roomId: string }> {
  const openedAt = new Date();
  const room = await db.room.create({
    data: {
      name: normalizeDocumentName(name),
      ownerId: userId,
      createdBy: userId,
      visibility: 'private',
      lastOpenedAt: openedAt,
      members: {
        create: {
          userId,
          role: 'owner',
          lastOpenedAt: openedAt,
        },
      },
    },
    select: { id: true },
  });

  return { roomId: room.id };
}

export async function recordDocumentOpen(
  db: PrismaClient,
  userId: string,
  roomId: string,
  openedAt = new Date(),
): Promise<void> {
  await assertCanViewDocument(db, roomId, userId);
  await db.room.update({
    where: { id: roomId },
    data: { lastOpenedAt: openedAt },
  });
  await db.roomMember.upsert({
    where: {
      roomId_userId: {
        roomId,
        userId,
      },
    },
    create: {
      roomId,
      userId,
      role: 'owner',
      lastOpenedAt: openedAt,
    },
    update: {
      lastOpenedAt: openedAt,
    },
  });
}

export async function updateDashboardDocument(
  db: PrismaClient,
  userId: string,
  roomId: string,
  input: { name?: string; archived?: boolean },
): Promise<DashboardDocument> {
  await assertCanManageDocument(db, roomId, userId);
  const data: { name?: string; archivedAt?: Date | null } = {};

  if (input.name !== undefined) {
    data.name = normalizeDocumentName(input.name);
  }

  if (input.archived !== undefined) {
    data.archivedAt = input.archived ? new Date() : null;
  }

  const room = (await db.room.update({
    where: { id: roomId },
    data,
    include: {
      owner: { select: { name: true, email: true } },
      members: {
        where: { userId },
        select: { role: true, lastOpenedAt: true },
      },
    },
  })) as RoomForDashboard;

  return toDashboardDocument(room, userId);
}

export async function deleteDashboardDocument(
  db: PrismaClient,
  userId: string,
  roomId: string,
): Promise<void> {
  await assertCanManageDocument(db, roomId, userId);
  await db.room.delete({ where: { id: roomId } });
}

async function assertCanViewDocument(
  db: PrismaClient,
  roomId: string,
  userId: string,
): Promise<void> {
  const room = await db.room.findFirst({
    where: {
      id: roomId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    select: { id: true },
  });

  if (!room) {
    throw new DocumentPermissionError('documents/not-found', 'Document was not found.');
  }
}

async function assertCanManageDocument(
  db: PrismaClient,
  roomId: string,
  userId: string,
): Promise<void> {
  const room = await db.room.findFirst({
    where: {
      id: roomId,
      OR: [
        { ownerId: userId },
        {
          members: {
            some: {
              userId,
              role: { in: ['owner', 'admin'] },
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  if (!room) {
    throw new DocumentPermissionError(
      'documents/forbidden',
      'Only a room owner or admin can manage this document.',
    );
  }
}

function buildDashboardWhere(
  userId: string,
  filters: DashboardListFilters,
): Record<string, unknown> {
  const and: Record<string, unknown>[] = [
    {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
  ];

  if (!filters.includeArchived) {
    and.push({ archivedAt: null });
  }

  if (filters.search) {
    and.push({
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { owner: { is: { name: { contains: filters.search, mode: 'insensitive' } } } },
        { owner: { is: { email: { contains: filters.search, mode: 'insensitive' } } } },
      ],
    });
  }

  if (filters.status === 'shared') {
    and.push({ ownerId: { not: userId }, members: { some: { userId } } });
  }

  if (filters.status === 'locked') {
    and.push({ locked: true });
  }

  return { AND: and };
}

function normalizeDocumentName(name: string): string {
  const trimmed = name.trim();
  return trimmed || 'Untitled';
}

function toDashboardDocument(room: RoomForDashboard, userId: string): DashboardDocument {
  const membership = room.members[0];
  return {
    id: room.id,
    name: room.name,
    ownerId: room.ownerId,
    ownerName: room.owner?.name ?? room.owner?.email ?? null,
    role: membership?.role ?? (room.ownerId === userId ? 'owner' : 'viewer'),
    visibility: room.visibility,
    locked: room.locked,
    archivedAt: room.archivedAt?.toISOString() ?? null,
    updatedAt: room.updatedAt.toISOString(),
    lastOpenedAt: membership?.lastOpenedAt?.toISOString() ?? null,
  };
}

function compareNullableIsoDesc(a: string | null, b: string | null): number {
  return (b ? Date.parse(b) : 0) - (a ? Date.parse(a) : 0);
}
