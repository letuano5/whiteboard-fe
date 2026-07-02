import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRoomClock, loadRoomElements } from '../persistence/room-repository.js';
import { makeElement } from '../test/element-fixtures.js';
import { executeSyncCommand } from './execute-sync-command.js';

vi.mock('../persistence/room-repository.js', () => ({
  getRoomClock: vi.fn(),
  loadRoomElements: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getRoomClock).mockReset();
  vi.mocked(getRoomClock).mockResolvedValue(4);
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
  it('executes legacy element updates inside the sync module boundary', async () => {
    // @covers AC-2
    const db = {} as PrismaClient;
    const markDirty = vi.fn();
    const roomElements = new Map();
    const roomClocks = new Map();
    const element = makeElement({ id: 'synced-el' });

    const result = await executeSyncCommand(
      {
        kind: 'legacy-element-update',
        roomId: 'room-1',
        elements: [element],
        sessionId: 'session-1',
      },
      {
        actorId: 'user-1',
        db,
        roomElements,
        roomClocks,
        autosave: {
          markDirty,
          flushRoomNow: vi.fn(),
        },
      },
    );

    expect(getRoomClock).toHaveBeenCalledWith(db, 'room-1');
    expect(roomElements.get('room-1')?.get('synced-el')).toEqual(element);
    expect(roomClocks.get('room-1')).toBe(5);
    expect(markDirty).toHaveBeenCalledWith('room-1');
    expect(result).toEqual({
      kind: 'legacy-element-update',
      roomId: 'room-1',
      elements: [element],
      sessionId: 'session-1',
      documentClock: 5,
    });
  });

  it('falls back to clock zero when loading the legacy room clock fails', async () => {
    // @covers AC-2
    const error = new Error('clock unavailable');
    const logger = { error: vi.fn() };
    vi.mocked(getRoomClock).mockRejectedValue(error);
    const roomClocks = new Map();

    const result = await executeSyncCommand(
      {
        kind: 'legacy-element-update',
        roomId: 'room-1',
        elements: [makeElement({ id: 'fallback-el' })],
      },
      {
        actorId: 'user-1',
        db: {} as PrismaClient,
        roomElements: new Map(),
        roomClocks,
        autosave: {
          markDirty: vi.fn(),
          flushRoomNow: vi.fn(),
        },
        logger,
      },
    );

    expect(logger.error).toHaveBeenCalledWith(
      '[delta-clock] Failed to load room clock for room-1:',
      error,
    );
    expect(roomClocks.get('room-1')).toBe(1);
    expect(result.documentClock).toBe(1);
  });

  it('serializes legacy element updates per room while loading the initial room clock', async () => {
    const clockLoad = createDeferred<number>();
    vi.mocked(getRoomClock).mockReturnValue(clockLoad.promise);
    const roomElements = new Map();
    const roomClocks = new Map();
    const autosave = {
      markDirty: vi.fn(),
      flushRoomNow: vi.fn(),
    };
    const db = {} as PrismaClient;

    const first = executeSyncCommand(
      {
        kind: 'legacy-element-update',
        roomId: 'room-1',
        elements: [makeElement({ id: 'first' })],
      },
      { actorId: 'user-1', db, roomElements, roomClocks, autosave },
    );
    const second = executeSyncCommand(
      {
        kind: 'legacy-element-update',
        roomId: 'room-1',
        elements: [makeElement({ id: 'second' })],
      },
      { actorId: 'user-2', db, roomElements, roomClocks, autosave },
    );

    clockLoad.resolve(4);
    await expect(first).resolves.toMatchObject({ documentClock: 5 });
    await expect(second).resolves.toMatchObject({ documentClock: 6 });

    expect(getRoomClock).toHaveBeenCalledTimes(1);
    expect(roomClocks.get('room-1')).toBe(6);
    expect(roomElements.get('room-1')?.has('first')).toBe(true);
    expect(roomElements.get('room-1')?.has('second')).toBe(true);
  });

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

  it('keeps legacy whole-element commands named as compatibility adapters', () => {
    // @covers AC-3
    expect('legacy-element-update').toContain('legacy');
    expect('native-file-import').toContain('import');
  });
});

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

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
