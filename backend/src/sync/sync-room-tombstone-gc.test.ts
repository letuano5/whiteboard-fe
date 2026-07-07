import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { gcTombstones, startTombstoneGc } from './sync-room-tombstone-gc.js';

function makeMockDb({
  candidateRoomIds = ['room-1'],
  documentClock = 150n,
  maxDeletedClock = 99n,
}: {
  candidateRoomIds?: string[];
  documentClock?: bigint;
  maxDeletedClock?: bigint | null;
} = {}) {
  const findMany = vi.fn().mockResolvedValue(candidateRoomIds.map((id) => ({ id })));
  const findUnique = vi.fn().mockResolvedValue({
    documentClock,
    tombstoneHistoryStartsAtClock: 0n,
  });
  const aggregate = vi.fn().mockResolvedValue({
    _max: { deletedClock: maxDeletedClock },
  });
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });

  const tx = {
    room: { findUnique, updateMany },
    tombstone: { aggregate, deleteMany },
  };
  const db = {
    room: { findMany },
    $transaction: vi.fn((task: (innerTx: typeof tx) => unknown) => task(tx)),
  } as unknown as PrismaClient;

  return { db, findMany, findUnique, aggregate, updateMany, deleteMany };
}

describe('gcTombstones', () => {
  it('advances tombstoneHistoryStartsAtClock before pruning stale tombstones', async () => {
    const { db, findMany, findUnique, aggregate, updateMany, deleteMany } = makeMockDb({
      documentClock: 150n,
      maxDeletedClock: 99n,
    });

    await gcTombstones(db, { retainClockWindow: 50 });

    expect(findMany).toHaveBeenCalledWith({
      where: { documentClock: { gt: 50n } },
      select: { id: true },
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      select: { documentClock: true, tombstoneHistoryStartsAtClock: true },
    });
    expect(aggregate).toHaveBeenCalledWith({
      where: { roomId: 'room-1', deletedClock: { lte: 100n } },
      _max: { deletedClock: true },
    });

    const updateOrder = updateMany.mock.invocationCallOrder[0]!;
    const deleteOrder = deleteMany.mock.invocationCallOrder[0]!;
    expect(updateOrder).toBeLessThan(deleteOrder);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'room-1', tombstoneHistoryStartsAtClock: { lt: 99n } },
      data: { tombstoneHistoryStartsAtClock: 99n },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { roomId: 'room-1', deletedClock: { lte: 99n } },
    });
  });

  it('skips rooms with no tombstones old enough to prune', async () => {
    const { db, updateMany, deleteMany } = makeMockDb({ maxDeletedClock: null });

    await gcTombstones(db, { retainClockWindow: 50 });

    expect(updateMany).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('logs and continues when a room fails to GC', async () => {
    const { db, updateMany } = makeMockDb({ candidateRoomIds: ['room-fail', 'room-ok'] });
    updateMany.mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce({ count: 1 });
    const logger = { error: vi.fn() };

    await gcTombstones(db, { retainClockWindow: 50, logger });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('room-fail'),
      expect.any(Error),
    );
    expect(updateMany).toHaveBeenCalledTimes(2);
  });
});

describe('startTombstoneGc', () => {
  it('runs gcTombstones on the configured interval and stops on demand', async () => {
    vi.useFakeTimers();
    const { db, findMany } = makeMockDb({ candidateRoomIds: [] });

    const stop = startTombstoneGc(db, { intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(findMany).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(findMany).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(findMany).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
