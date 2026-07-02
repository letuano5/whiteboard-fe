import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomAccessPayload } from '@vdt/shared';
import type { AppUser } from '../auth/index.js';
import { makeElement } from '../test/element-fixtures.js';
import { getOrCreateSyncRoom, type SyncRoom } from '../sync/index.js';
import { resolveRoomAccess } from './room-roles.js';
import { exportNativeFileFromRoom } from './native-file-export.js';

vi.mock('../sync/index.js', () => ({
  getOrCreateSyncRoom: vi.fn(),
}));

vi.mock('./room-roles.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./room-roles.js')>();
  return {
    ...actual,
    resolveRoomAccess: vi.fn(),
  };
});

const user: AppUser = {
  id: 'user-1',
  provider: 'test',
  providerSubject: 'user-1',
  email: 'user@example.com',
  name: null,
  avatarUrl: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

beforeEach(() => {
  vi.mocked(resolveRoomAccess).mockReset();
  vi.mocked(getOrCreateSyncRoom).mockReset();
});

describe('native file export', () => {
  it('exports saved documents from the materialized SyncRoom server snapshot', async () => {
    // @covers AC-1
    vi.mocked(resolveRoomAccess).mockResolvedValue(makeAccessPayload('viewer'));
    const serverElement = makeElement({ id: 'server-truth', zIndex: 7 });
    const syncRoom = makeSyncRoom(serverElement, 12);
    vi.mocked(getOrCreateSyncRoom).mockResolvedValue(syncRoom);
    const db = makeDb('Server Board');
    const syncRooms = new Map();

    const result = await exportNativeFileFromRoom(db, syncRooms, 'room-1', user);

    expect(getOrCreateSyncRoom).toHaveBeenCalledWith(db, syncRooms, 'room-1');
    expect(result.document.elements).toEqual([serverElement]);
    expect(result.document.room).toMatchObject({
      id: 'room-1',
      name: 'Server Board',
      source: 'saved',
    });
    expect(result.documentClock).toBe('12');
  });

  it('does not mutate the document clock during export after committed edits', async () => {
    // @covers AC-2
    vi.mocked(resolveRoomAccess).mockResolvedValue(makeAccessPayload('editor'));
    const syncRoom = makeSyncRoom(makeElement({ id: 'latest-commit' }), 21);
    vi.mocked(getOrCreateSyncRoom).mockResolvedValue(syncRoom);
    const db = makeDb('Read Only Board');

    const result = await exportNativeFileFromRoom(db, undefined, 'room-1', user);

    expect(result.documentClock).toBe('21');
    expect(db.room.update).not.toHaveBeenCalled();
    expect(db.room.updateMany).not.toHaveBeenCalled();
  });
});

function makeSyncRoom(element: ReturnType<typeof makeElement>, documentClock: number): SyncRoom {
  return {
    getStateSnapshot: () => ({
      elements: new Map([[element.id, element]]),
      documentClock,
      roomEpoch: 0,
      slotClocks: new Map(),
      tombstoneElementIds: new Set(),
      processedRequests: new Map(),
    }),
  } as unknown as SyncRoom;
}

function makeDb(name: string): PrismaClient {
  return {
    room: {
      findUnique: vi.fn().mockResolvedValue({ name }),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  } as unknown as PrismaClient;
}

function makeAccessPayload(effectiveRole: 'owner' | 'editor' | 'viewer'): RoomAccessPayload {
  return {
    roomId: 'room-1',
    role: effectiveRole,
    baseRole: effectiveRole,
    effectiveRole,
    visibility: 'private',
    maxParticipants: null,
    maxEditors: null,
    shareRevokedAt: null,
    members: [],
    invitations: [],
  };
}
