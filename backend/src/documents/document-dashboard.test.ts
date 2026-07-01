import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  createDashboardDocument,
  deleteDashboardDocument,
  DocumentPermissionError,
  listDashboardDocuments,
  recordDocumentOpen,
  updateDashboardDocument,
} from './document-service.js';
import { encodeDashboardCursor } from './document-pagination.js';

const ownedOpenedAt = new Date('2026-06-30T10:00:00.000Z');
const sharedOpenedAt = new Date('2026-06-30T11:00:00.000Z');
const updatedAt = new Date('2026-06-30T09:00:00.000Z');

function makeRoom(overrides: Partial<DashboardRoom> = {}): DashboardRoom {
  return {
    id: 'room-owned',
    name: 'Owned Plan',
    ownerId: 'user-123',
    owner: { name: 'Owner User', email: 'owner@example.com' },
    visibility: 'private',
    locked: false,
    archivedAt: null,
    updatedAt,
    members: [{ role: 'owner', lastOpenedAt: ownedOpenedAt }],
    records: [],
    ...overrides,
  };
}

interface DashboardRoom {
  id: string;
  name: string;
  ownerId: string | null;
  owner: { name: string | null; email: string | null } | null;
  visibility: string;
  locked: boolean;
  archivedAt: Date | null;
  updatedAt: Date;
  members: { role: string; lastOpenedAt: Date | null }[];
  records: { state: unknown }[];
}

function buildDb(rooms: DashboardRoom[] = []) {
  const roomFindMany = vi.fn().mockResolvedValue(rooms);
  const roomCreate = vi.fn().mockResolvedValue({ id: 'room-created' });
  const roomFindFirst = vi.fn().mockResolvedValue({ id: 'room-accessible' });
  const roomUpdate = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve(
      makeRoom({
        name: typeof data.name === 'string' ? data.name : 'Updated Plan',
        archivedAt: data.archivedAt instanceof Date ? data.archivedAt : null,
      }),
    ),
  );
  const roomDelete = vi.fn().mockResolvedValue({ id: 'room-deleted' });
  const roomMemberUpsert = vi.fn().mockResolvedValue({});
  const db = {
    room: {
      findMany: roomFindMany,
      create: roomCreate,
      findFirst: roomFindFirst,
      update: roomUpdate,
      delete: roomDelete,
    },
    roomMember: {
      upsert: roomMemberUpsert,
    },
  } as unknown as PrismaClient;

  return { db, roomFindMany, roomCreate, roomFindFirst, roomUpdate, roomDelete, roomMemberUpsert };
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('listDashboardDocuments', () => {
  it('scopes search and ownership filter queries to rooms the user can access', async () => {
    // @covers AC-2
    // @covers AC-4
    const { db, roomFindMany } = buildDb();

    await listDashboardDocuments(db, 'user-123', { search: 'briefing', scope: 'shared' });

    const query = roomFindMany.mock.calls[0]?.[0] as { where: { AND: unknown[] } };
    expect(query.where.AND[0]).toEqual({
      OR: [{ ownerId: 'user-123' }, { members: { some: { userId: 'user-123' } } }],
    });
    expect(query.where.AND).toContainEqual({ archivedAt: null });
    expect(query.where.AND).toContainEqual({
      ownerId: { not: 'user-123' },
      members: { some: { userId: 'user-123' } },
    });
    expect(query.where.AND).toContainEqual({
      OR: [
        { name: { contains: 'briefing', mode: 'insensitive' } },
        { owner: { is: { name: { contains: 'briefing', mode: 'insensitive' } } } },
        { owner: { is: { email: { contains: 'briefing', mode: 'insensitive' } } } },
      ],
    });
  });

  it('uses keyset pagination without offset', async () => {
    // @covers AC-8
    const { db, roomFindMany } = buildDb();
    const cursor = encodeDashboardCursor(new Date('2026-06-30T09:00:00.000Z'), 'room-09');

    await listDashboardDocuments(db, 'user-123', { cursor, limit: 10 });

    const query = roomFindMany.mock.calls[0]?.[0] as {
      orderBy: unknown;
      skip?: number;
      take: number;
      where: { AND: unknown[] };
    };
    expect(query.orderBy).toEqual([{ updatedAt: 'desc' }, { id: 'desc' }]);
    expect(query.take).toBe(11);
    expect(query.skip).toBeUndefined();
    expect(query.where.AND).toContainEqual({
      OR: [
        { updatedAt: { lt: new Date('2026-06-30T09:00:00.000Z') } },
        { updatedAt: new Date('2026-06-30T09:00:00.000Z'), id: { lt: 'room-09' } },
      ],
    });
  });

  it('returns recent documents with preview elements and a next cursor', async () => {
    // @covers AC-3
    // @covers AC-7
    const rooms = Array.from({ length: 11 }, (_, index) =>
      makeRoom({
        id: `room-${String(index).padStart(2, '0')}`,
        name: index === 0 ? 'Shared Plan' : 'Owned Plan',
        ownerId: index === 0 ? 'owner-456' : 'user-123',
        updatedAt: new Date(`2026-06-30T10:${String(59 - index).padStart(2, '0')}:00.000Z`),
        members: [
          {
            role: index === 0 ? 'viewer' : 'owner',
            lastOpenedAt: index === 0 ? sharedOpenedAt : ownedOpenedAt,
          },
        ],
        records:
          index === 0
            ? [
                {
                  state: {
                    id: 'preview-el',
                    type: 'rectangle',
                    x: 10,
                    y: 20,
                    width: 30,
                    height: 40,
                    zIndex: 1,
                    isDeleted: false,
                    props: {},
                  },
                },
              ]
            : [],
      }),
    );
    const { db } = buildDb(rooms);

    const result = await listDashboardDocuments(db, 'user-123');

    expect(result.documents).toHaveLength(10);
    expect(result.documents[0]?.id).toBe('room-00');
    expect(result.documents[0]?.previewElements.map((element) => element.id)).toEqual([
      'preview-el',
    ]);
    expect(result.nextCursor).toEqual(expect.any(String));
  });
});

describe('createDashboardDocument', () => {
  it('creates a private owned room with owner membership', async () => {
    // @covers AC-5
    const { db, roomCreate } = buildDb();

    const result = await createDashboardDocument(db, 'user-123', '  Operation Map  ');

    expect(result).toEqual({ roomId: 'room-created' });
    expect(roomCreate).toHaveBeenCalledWith({
      data: {
        name: 'Operation Map',
        ownerId: 'user-123',
        createdBy: 'user-123',
        visibility: 'private',
        lastOpenedAt: expect.any(Date) as Date,
        members: {
          create: {
            userId: 'user-123',
            role: 'owner',
            lastOpenedAt: expect.any(Date) as Date,
          },
        },
      },
      select: { id: true },
    });
  });
});

describe('document management permissions', () => {
  it('rejects rename, archive, and delete when actor is not owner or admin', async () => {
    // @covers AC-6
    const { db, roomFindFirst, roomUpdate, roomDelete } = buildDb();
    roomFindFirst.mockResolvedValue(null);

    await expect(
      updateDashboardDocument(db, 'viewer-123', 'room-abc', { name: 'Denied' }),
    ).rejects.toBeInstanceOf(DocumentPermissionError);
    await expect(
      updateDashboardDocument(db, 'viewer-123', 'room-abc', { archived: true }),
    ).rejects.toBeInstanceOf(DocumentPermissionError);
    await expect(deleteDashboardDocument(db, 'viewer-123', 'room-abc')).rejects.toBeInstanceOf(
      DocumentPermissionError,
    );
    expect(roomUpdate).not.toHaveBeenCalled();
    expect(roomDelete).not.toHaveBeenCalled();
  });

  it('allows owner or admin management queries through the same guard', async () => {
    // @covers AC-6
    const { db, roomFindFirst } = buildDb();

    await updateDashboardDocument(db, 'admin-123', 'room-abc', { archived: true });

    expect(roomFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'room-abc',
        OR: [
          { ownerId: 'admin-123' },
          {
            members: {
              some: {
                userId: 'admin-123',
                role: { in: ['owner', 'admin'] },
              },
            },
          },
        ],
      },
      select: { id: true },
    });
  });
});

describe('recordDocumentOpen', () => {
  it('updates room and membership lastOpenedAt for the current user', async () => {
    // @covers AC-7
    const { db, roomUpdate, roomMemberUpsert } = buildDb();
    const openedAt = new Date('2026-06-30T12:00:00.000Z');

    await recordDocumentOpen(db, 'user-123', 'room-opened', openedAt);

    expect(roomUpdate).toHaveBeenCalledWith({
      where: { id: 'room-opened' },
      data: { lastOpenedAt: openedAt },
    });
    expect(roomMemberUpsert).toHaveBeenCalledWith({
      where: {
        roomId_userId: {
          roomId: 'room-opened',
          userId: 'user-123',
        },
      },
      create: {
        roomId: 'room-opened',
        userId: 'user-123',
        role: 'owner',
        lastOpenedAt: openedAt,
      },
      update: {
        lastOpenedAt: openedAt,
      },
    });
  });
});
