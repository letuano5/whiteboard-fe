import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadRoomElements } from '../persistence/room-repository.js';
import { makeElement } from '../test/element-fixtures.js';
import { executeSyncCommand } from './execute-sync-command.js';

vi.mock('../persistence/room-repository.js', () => ({
  loadRoomElements: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(loadRoomElements).mockReset();
  vi.mocked(loadRoomElements).mockResolvedValue({
    elements: [],
    documentClock: 2,
    roomEpoch: 7,
    slotClocks: [],
    tombstoneElementIds: [],
  });
});

describe('executeSyncCommand', () => {
  it('executes native file import persistence through the sync module boundary', async () => {
    // @covers AC-1
    const { db, tx } = makeReplaceDb();
    const element = makeElement({ id: 'imported-el' });

    await expect(
      executeSyncCommand(
        {
          kind: 'native-file-import',
          roomId: 'room-1',
          elements: [element],
        },
        {
          actorId: 'user-1',
          db,
        },
      ),
    ).resolves.toEqual({
      kind: 'native-file-import',
      roomId: 'room-1',
      importedElementCount: 1,
      documentClock: '3',
      roomEpoch: 8,
      replacePayload: expect.objectContaining({
        roomId: 'room-1',
        serverClock: 3,
        roomEpoch: 8,
        elements: [expect.objectContaining({ id: 'imported-el' })],
      }),
    });

    expect(loadRoomElements).toHaveBeenCalledWith(db, 'room-1');
    expect(tx.room.updateMany).toHaveBeenCalledWith({
      where: { id: 'room-1', documentClock: 2n },
      data: { documentClock: 3n, roomEpoch: 8n },
    });
    expect(tx.record.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { roomId_recordId: { roomId: 'room-1', recordId: 'imported-el' } },
      }),
    );
  });

});

function makeReplaceDb(): { db: PrismaClient; tx: ReplaceTransaction } {
  const tx: ReplaceTransaction = {
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    room: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn(),
    },
    record: {
      upsert: vi.fn().mockResolvedValue(undefined),
      deleteMany: vi.fn().mockResolvedValue(undefined),
    },
    tombstone: {
      upsert: vi.fn().mockResolvedValue(undefined),
      deleteMany: vi.fn().mockResolvedValue(undefined),
    },
    processedRequest: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  };
  const db = {
    processedRequest: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn(async (task: (transaction: ReplaceTransaction) => Promise<unknown>) =>
      task(tx),
    ),
  } as unknown as PrismaClient;
  return { db, tx };
}

interface ReplaceTransaction {
  $executeRawUnsafe: ReturnType<typeof vi.fn>;
  room: {
    updateMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  record: {
    upsert: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  tombstone: {
    upsert: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  processedRequest: {
    create: ReturnType<typeof vi.fn>;
  };
}
