import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeFileDocument, RoomAccessPayload } from '@vdt/shared';
import type { AppUser } from '../auth/index.js';
import { makeElement } from '../test/element-fixtures.js';
import { saveRoomElements } from '../persistence/room-repository.js';
import { resolveRoomAccess } from './room-roles.js';
import { importNativeFileIntoRoom, readNativeFileImportPayload } from './native-file-import.js';

vi.mock('../persistence/room-repository.js', () => ({
  saveRoomElements: vi.fn().mockResolvedValue({ documentClock: 3n }),
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

const document: NativeFileDocument = {
  kind: 'vdt.whiteboard.native',
  schemaVersion: 1,
  room: {
    id: 'room-1',
    name: 'Room 1',
    source: 'saved',
    exportedAt: '2026-07-01T00:00:00.000Z',
  },
  camera: { x: 0, y: 0, zoom: 1 },
  elements: [makeElement({ id: 'imported-1' })],
  assets: [],
};

beforeEach(() => {
  vi.mocked(saveRoomElements).mockReset();
  vi.mocked(saveRoomElements).mockResolvedValue({ documentClock: 3n });
  vi.mocked(resolveRoomAccess).mockReset();
});

describe('native file import', () => {
  it('persists editor imports through the room repository batch path', async () => {
    // @covers AC-3
    vi.mocked(resolveRoomAccess).mockResolvedValue(makeAccessPayload('editor'));
    const db = {} as PrismaClient;

    await expect(importNativeFileIntoRoom(db, 'room-1', user, document)).resolves.toEqual({
      importedElementCount: 1,
      documentClock: '3',
    });

    expect(saveRoomElements).toHaveBeenCalledWith(db, 'room-1', document.elements);
  });

  it('rejects viewer imports before persistence', async () => {
    // @covers AC-3
    vi.mocked(resolveRoomAccess).mockResolvedValue(makeAccessPayload('viewer'));

    await expect(
      importNativeFileIntoRoom({} as PrismaClient, 'room-1', user, document),
    ).rejects.toThrow('Editor or owner access is required to import into this document.');
    expect(saveRoomElements).not.toHaveBeenCalled();
  });

  it('rejects invalid native payloads before handler execution', () => {
    // @covers AC-4
    expect(readNativeFileImportPayload({ document, mode: 'merge' })).toEqual({
      document,
      mode: 'merge',
    });
    expect(
      readNativeFileImportPayload({ document: { ...document, schemaVersion: 2 }, mode: 'merge' }),
    ).toBeNull();
    expect(readNativeFileImportPayload({ document, mode: 'overwrite' })).toBeNull();
  });
});

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
