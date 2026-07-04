import type { PrismaClient } from '@prisma/client';
import { DASHBOARD_PREVIEW_ELEMENT_LIMIT } from '@vdt/shared';
import type {
  DashboardDocument,
  DashboardListFilters,
  DocumentDashboardResponse,
  RoomForDashboard,
} from './types.js';
import {
  clampPageSize,
  decodeDashboardCursor,
  encodeDashboardCursor,
} from './document-pagination.js';
import { isPreviewElement } from './document-preview.js';

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
  const pageSize = clampPageSize(filters.limit);
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
      records: {
        where: { typeName: { not: '' } },
        select: { state: true },
        orderBy: { recordClock: 'desc' },
        take: DASHBOARD_PREVIEW_ELEMENT_LIMIT,
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: pageSize + 1,
  })) as RoomForDashboard[];

  const hasMore = rooms.length > pageSize;
  const pageRooms = hasMore ? rooms.slice(0, pageSize) : rooms;
  const documents = pageRooms.map((room) => toDashboardDocument(room, userId));
  const lastRoom = pageRooms.at(-1) ?? null;

  return {
    documents,
    nextCursor: hasMore && lastRoom ? encodeDashboardCursor(lastRoom.updatedAt, lastRoom.id) : null,
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
      records: {
        where: { typeName: { not: '' } },
        select: { state: true },
        orderBy: { recordClock: 'desc' },
        take: DASHBOARD_PREVIEW_ELEMENT_LIMIT,
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

  and.push({ archivedAt: null });

  if (filters.search) {
    and.push({
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { owner: { is: { name: { contains: filters.search, mode: 'insensitive' } } } },
        { owner: { is: { email: { contains: filters.search, mode: 'insensitive' } } } },
      ],
    });
  }

  if (filters.scope === 'owned') {
    and.push({ ownerId: userId });
  }

  if (filters.scope === 'shared') {
    and.push({ ownerId: { not: userId }, members: { some: { userId } } });
  }

  const cursor = filters.cursor ? decodeDashboardCursor(filters.cursor) : null;
  if (cursor) {
    and.push({
      OR: [
        { updatedAt: { lt: cursor.updatedAt } },
        { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
      ],
    });
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
    previewElements: room.records.map((record) => record.state).filter(isPreviewElement),
  };
}
