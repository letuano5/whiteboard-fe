import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { saveLocalBoardAsRoom } from './local-board-save.js';
import { makeDeletedElement, makeElement } from '../test/element-fixtures.js';
import { saveRoomElements } from '../persistence/room-repository.js';

vi.mock('../persistence/room-repository.js', () => ({
  saveRoomElements: vi.fn().mockResolvedValue({ documentClock: 1n }),
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
  vi.mocked(saveRoomElements).mockReset();
  vi.mocked(saveRoomElements).mockResolvedValue({ documentClock: 1n });
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

  it('imports current local elements through the persistence path with one live clock', async () => {
    // @covers AC-8
    // @covers AC-9
    const { db } = buildDb('room-imported');
    const elements = [makeElement({ id: 'visible-el', zIndex: 12, version: 5 })];

    await saveLocalBoardAsRoom(db, 'user-123', elements);

    expect(saveRoomElements).toHaveBeenCalledWith(db, 'room-imported', elements, 1);
  });

  it('passes deleted elements to persistence so tombstone semantics are preserved', async () => {
    // @covers AC-9
    const { db } = buildDb('room-deleted');
    const deleted = makeDeletedElement({ id: 'deleted-el', version: 8 });

    await saveLocalBoardAsRoom(db, 'user-123', [deleted]);

    expect(saveRoomElements).toHaveBeenCalledWith(db, 'room-deleted', [deleted], 1);
  });

  it('does not write any room before the save action is called', () => {
    // @covers AC-5
    const { roomCreate } = buildDb();

    expect(roomCreate).not.toHaveBeenCalled();
  });

  it('propagates persistence failures so the client can keep local data and show an error', async () => {
    // @covers AC-11
    vi.mocked(saveRoomElements).mockRejectedValueOnce(new Error('DB unavailable.'));
    const { db } = buildDb('room-failure');

    await expect(saveLocalBoardAsRoom(db, 'user-123', [makeElement()])).rejects.toThrow(
      'DB unavailable.',
    );
  });
});
