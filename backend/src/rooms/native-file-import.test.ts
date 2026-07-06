import type { PrismaClient } from '@prisma/client';
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeFileDocument, RoomAccessPayload } from '@vdt/shared';
import type { AppUser } from '../auth/index.js';
import { makeElement } from '../test/element-fixtures.js';
import { executeSyncCommand } from '../sync/index.js';
import { resolveRoomAccess } from './room-roles.js';
import {
  importNativeFileIntoRoom,
  readNativeFileImportPayload,
  sendKnownImportError,
} from './native-file-import.js';

vi.mock('../sync/index.js', () => ({
  deleteSyncRoom: vi.fn(),
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
    // @covers AC-6 (P4-07)
    vi.mocked(resolveRoomAccess).mockResolvedValue(makeAccessPayload('editor'));
    const { db, snapshotCreate } = buildImportDb();

    await expect(importNativeFileIntoRoom(db, 'room-1', user, document)).resolves.toEqual({
      importedElementCount: 1,
      documentClock: '3',
      roomEpoch: 2,
      report: {
        importedCount: 1,
        skippedCount: 0,
        skipped: [],
      },
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
    expect(snapshotCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        roomId: 'room-1',
        reason: 'import_safety',
        records: document.elements,
      }),
      select: { id: true },
    });
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
    expect(readNativeFileImportPayload({ document, mode: 'replace' })).toEqual({
      document,
      mode: 'replace',
      report: {
        importedCount: 1,
        skippedCount: 0,
        skipped: [],
      },
    });
    expect(
      readNativeFileImportPayload({ document: { ...document, schemaVersion: 2 }, mode: 'replace' }),
    ).toBeNull();
    expect(readNativeFileImportPayload({ document, mode: 'merge' })).toBeNull();
    expect(readNativeFileImportPayload({ document, mode: 'overwrite' })).toBeNull();
  });

  it('rejects a camera zoom outside the documented [0.1, 8] range (H6 audit fix)', () => {
    // @covers H6 audit fix — native file import must not bypass the zoom clamp
    expect(
      readNativeFileImportPayload({
        document: { ...document, camera: { x: 0, y: 0, zoom: 500 } },
        mode: 'replace',
      }),
    ).toBeNull();
    expect(
      readNativeFileImportPayload({
        document: { ...document, camera: { x: 0, y: 0, zoom: 0 } },
        mode: 'replace',
      }),
    ).toBeNull();
  });

  it('skips unsupported element objects with a report before replace execution', () => {
    // @covers AC-4
    const payload = readNativeFileImportPayload({
      document: {
        ...document,
        elements: [
          document.elements[0],
          {
            ...document.elements[0],
            id: 'unsupported-1',
            type: 'unsupported-shape',
          },
        ],
      },
      mode: 'replace',
    });

    expect(payload?.document.elements).toEqual(document.elements);
    expect(payload?.report).toEqual({
      importedCount: 1,
      skippedCount: 1,
      skipped: [{ index: 1, reason: 'Element type "unsupported-shape" is unsupported.' }],
    });
  });

  it('responds with a 500 instead of throwing on an unrecognized error', () => {
    // @covers H2 audit fix — unhandled errors must not escape the route handler
    const status = vi.fn().mockReturnThis();
    const json = vi.fn().mockReturnThis();
    const response = { status, json } as unknown as Response;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => sendKnownImportError(response, new Error('db connection lost'))).not.toThrow();

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'native-file/internal-error', message: 'Failed to import the document.' },
    });
    consoleError.mockRestore();
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

function buildImportDb() {
  const snapshotCreate = vi.fn().mockResolvedValue({ id: 'import-safety-1' });
  const roomFindUnique = vi.fn().mockResolvedValue({
    documentClock: 2n,
    roomEpoch: 1n,
    records: document.elements.map((state) => ({ state })),
    tombstones: [],
  });
  const db = {
    room: { findUnique: roomFindUnique },
    snapshot: { create: snapshotCreate },
  } as unknown as PrismaClient;
  return { db, snapshotCreate, roomFindUnique };
}
