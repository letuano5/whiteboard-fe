import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeFileDocument, RoomAccessPayload } from '@vdt/shared';
import type { AppUser } from '../auth/index.js';
import { makeElement } from '../test/element-fixtures.js';
import { executeSyncCommand } from '../sync/index.js';
import { resolveRoomAccess } from './room-roles.js';
import { importNativeFileIntoRoom, readNativeFileImportPayload } from './native-file-import.js';

vi.mock('../sync/index.js', () => ({
  executeSyncCommand: vi.fn().mockResolvedValue({
    kind: 'native-file-import',
    roomId: 'room-1',
    importedElementCount: 1,
    documentClock: '3',
    roomEpoch: 2,
    replacePayload: {
      protocolVersion: 1,
      schemaVersion: 1,
      roomId: 'room-1',
      serverClock: 3,
      roomEpoch: 2,
      elements: [],
      slotClocks: [],
    },
  }),
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
  vi.mocked(executeSyncCommand).mockReset();
  vi.mocked(executeSyncCommand).mockResolvedValue({
    kind: 'native-file-import',
    roomId: 'room-1',
    importedElementCount: 1,
    documentClock: '3',
    roomEpoch: 2,
    replacePayload: {
      protocolVersion: 1,
      schemaVersion: 1,
      roomId: 'room-1',
      serverClock: 3,
      roomEpoch: 2,
      elements: [],
      slotClocks: [],
    },
  });
  vi.mocked(resolveRoomAccess).mockReset();
});

describe('native file import', () => {
  it('persists editor imports through the sync module entrypoint', async () => {
    // @covers AC-2
    vi.mocked(resolveRoomAccess).mockResolvedValue(makeAccessPayload('editor'));
    const db = {} as PrismaClient;

    await expect(importNativeFileIntoRoom(db, 'room-1', user, document)).resolves.toEqual({
      importedElementCount: 1,
      documentClock: '3',
      roomEpoch: 2,
    });

    expect(executeSyncCommand).toHaveBeenCalledWith(
      {
        kind: 'native-file-import',
        roomId: 'room-1',
        elements: document.elements,
      },
      {
        actorId: user.id,
        db,
      },
    );
  });

  it('rejects viewer imports before persistence', async () => {
    // @covers AC-2
    vi.mocked(resolveRoomAccess).mockResolvedValue(makeAccessPayload('viewer'));

    await expect(
      importNativeFileIntoRoom({} as PrismaClient, 'room-1', user, document),
    ).rejects.toThrow('Editor or owner access is required to import into this document.');
    expect(executeSyncCommand).not.toHaveBeenCalled();
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
