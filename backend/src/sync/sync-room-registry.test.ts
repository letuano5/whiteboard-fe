import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { getOrCreateSyncRoom } from './sync-room-registry.js';
import type { SyncRoom } from './sync-room.js';

describe('getOrCreateSyncRoom', () => {
  it('shares one pending load for concurrent callers of the same room', async () => {
    // @covers M5
    let resolveLoad: (room: unknown) => void = () => undefined;
    const findUnique = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const db = {
      room: { findUnique },
      processedRequest: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(),
    } as unknown as PrismaClient;
    const syncRooms = new Map<string, SyncRoom>();

    const first = getOrCreateSyncRoom(db, syncRooms, 'room-1');
    const second = getOrCreateSyncRoom(db, syncRooms, 'room-1');

    expect(findUnique).toHaveBeenCalledTimes(1);
    resolveLoad({
      documentClock: 0n,
      roomEpoch: 0n,
      processedRequestHistoryStartsAtClock: 0n,
      records: [],
      tombstones: [],
    });

    const [left, right] = await Promise.all([first, second]);
    expect(left).toBe(right);
    expect(syncRooms.get('room-1')).toBe(left);
  });
});
