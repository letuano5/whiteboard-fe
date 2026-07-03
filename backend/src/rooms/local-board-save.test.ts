import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { saveLocalBoardAsRoom } from './local-board-save.js';
import { makeDeletedElement, makeElement } from '../test/element-fixtures.js';
import { executeSyncCommand } from '../sync/index.js';

vi.mock('../sync/index.js', () => ({
  executeSyncCommand: vi.fn().mockResolvedValue({
    kind: 'native-file-import',
    roomId: 'room-created',
    importedElementCount: 0,
    documentClock: '1',
    roomEpoch: 1,
    replacePayload: {
      protocolVersion: 1,
      schemaVersion: 1,
      roomId: 'room-created',
      serverClock: 1,
      roomEpoch: 1,
      elements: [],
      slotClocks: [],
    },
  }),
}));

function buildDb(roomId = 'room-created') {
  const roomCreate = vi.fn().mockResolvedValue({ id: roomId });
  const db = {
    room: {
      create: roomCreate,
    },
  } as unknown as PrismaClient;

  return { db, roomCreate };
}

beforeEach(() => {
  vi.mocked(executeSyncCommand).mockReset();
  vi.mocked(executeSyncCommand).mockResolvedValue({
    kind: 'native-file-import',
    roomId: 'room-created',
    importedElementCount: 0,
    documentClock: '1',
    roomEpoch: 1,
    replacePayload: {
      protocolVersion: 1,
      schemaVersion: 1,
      roomId: 'room-created',
      serverClock: 1,
      roomEpoch: 1,
      elements: [],
      slotClocks: [],
    },
  });
});

describe('saveLocalBoardAsRoom', () => {
  it('creates a new room with the authenticated user as owner', async () => {
    // @covers AC-8
    const { db, roomCreate } = buildDb();

    const result = await saveLocalBoardAsRoom(db, 'user-123', []);

    expect(result).toEqual({ roomId: 'room-created' });
    expect(roomCreate).toHaveBeenCalledWith({
      data: {
        ownerId: 'user-123',
        createdBy: 'user-123',
        visibility: 'private',
        members: {
          create: {
            userId: 'user-123',
            role: 'owner',
          },
        },
      },
      select: { id: true },
    });
  });

  it('imports current local elements through the sync module entrypoint', async () => {
    // @covers AC-8
    // @covers AC-9
    const { db } = buildDb('room-imported');
    const elements = [makeElement({ id: 'visible-el', zIndex: 12, version: 5 })];

    await saveLocalBoardAsRoom(db, 'user-123', elements);

    expect(executeSyncCommand).toHaveBeenCalledWith(
      {
        kind: 'native-file-import',
        roomId: 'room-imported',
        elements,
      },
      {
        actorId: 'user-123',
        db,
      },
    );
  });

  it('filters out soft-deleted elements so they are not resurrected on save', async () => {
    // @covers AC-9
    // Soft-deleted elements (isDeleted: true) must not reach the sync layer because
    // replace-document forces isDeleted: false on every element it receives, which would
    // resurrect elements the user already removed via undo.
    const { db } = buildDb('room-deleted');
    const deleted = makeDeletedElement({ id: 'deleted-el', version: 8 });
    const visible = makeElement({ id: 'visible-el', version: 3 });

    await saveLocalBoardAsRoom(db, 'user-123', [deleted, visible]);

    expect(executeSyncCommand).toHaveBeenCalledWith(
      {
        kind: 'native-file-import',
        roomId: 'room-deleted',
        elements: [visible],
      },
      {
        actorId: 'user-123',
        db,
      },
    );
  });

  it('does not write any room before the save action is called', () => {
    // @covers AC-5
    const { roomCreate } = buildDb();

    expect(roomCreate).not.toHaveBeenCalled();
  });

  it('propagates persistence failures so the client can keep local data and show an error', async () => {
    // @covers AC-11
    vi.mocked(executeSyncCommand).mockRejectedValueOnce(new Error('DB unavailable.'));
    const { db } = buildDb('room-failure');

    await expect(saveLocalBoardAsRoom(db, 'user-123', [makeElement()])).rejects.toThrow(
      'DB unavailable.',
    );
  });
});
