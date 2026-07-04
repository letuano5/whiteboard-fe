import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { gcProcessedRequests, startProcessedRequestGc } from './sync-room-processed-request-gc.js';

function makeMockDb(groupByResult: Array<{ roomId: string; _max: { serverClock: bigint | null } }>) {
  const groupBy = vi.fn().mockResolvedValue(groupByResult);
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });

  return {
    db: {
      processedRequest: { groupBy, deleteMany },
      room: { updateMany },
    } as unknown as PrismaClient,
    groupBy,
    deleteMany,
    updateMany,
  };
}

describe('gcProcessedRequests', () => {
  it('advances processedRequestHistoryStartsAtClock before deleting stale rows', async () => {
    const { db, groupBy, deleteMany, updateMany } = makeMockDb([
      { roomId: 'room-1', _max: { serverClock: 42n } },
    ]);

    await gcProcessedRequests(db, { maxAgeMs: 1000 });

    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['roomId'],
        _max: { serverClock: true },
      }),
    );

    const updateOrder = updateMany.mock.invocationCallOrder[0]!;
    const deleteOrder = deleteMany.mock.invocationCallOrder[0]!;
    expect(updateOrder).toBeLessThan(deleteOrder);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'room-1', processedRequestHistoryStartsAtClock: { lt: 42n } },
      data: { processedRequestHistoryStartsAtClock: 42n },
    });
    expect(deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ roomId: 'room-1' }) }),
    );
  });

  it('skips rooms with no stale rows', async () => {
    const { db, updateMany, deleteMany } = makeMockDb([]);

    await gcProcessedRequests(db);

    expect(updateMany).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('logs and continues when a room fails to GC', async () => {
    const { db, updateMany } = makeMockDb([
      { roomId: 'room-fail', _max: { serverClock: 5n } },
      { roomId: 'room-ok', _max: { serverClock: 9n } },
    ]);
    updateMany.mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce({ count: 1 });
    const logger = { error: vi.fn() };

    await gcProcessedRequests(db, { logger });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('room-fail'),
      expect.any(Error),
    );
    expect(updateMany).toHaveBeenCalledTimes(2);
  });
});

describe('startProcessedRequestGc', () => {
  it('runs gcProcessedRequests on the configured interval and stops on demand', async () => {
    vi.useFakeTimers();
    const { db, groupBy } = makeMockDb([]);

    const stop = startProcessedRequestGc(db, { intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(groupBy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(groupBy).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(groupBy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
