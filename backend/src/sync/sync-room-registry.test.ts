import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  deleteSyncRoom,
  evictIdleSyncRooms,
  getOrCreateSyncRoom,
  getSyncRoomRegistryMetrics,
  withSyncRoom,
} from './sync-room-registry.js';
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
    const db = makeDb(findUnique);
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
    expect(getSyncRoomRegistryMetrics(syncRooms)).toMatchObject({
      hotRoomCount: 1,
      loadingRoomCount: 0,
      loadCount: 1,
    });
  });

  it('evicts an idle room and records eviction metrics', async () => {
    const syncRooms = new Map<string, SyncRoom>();
    await getOrCreateSyncRoom(makeDb(), syncRooms, 'room-1');

    const evicted = evictIdleSyncRooms(syncRooms, { idleTtlMs: 0, now: Date.now() });

    expect(evicted).toBe(1);
    expect(syncRooms.has('room-1')).toBe(false);
    expect(getSyncRoomRegistryMetrics(syncRooms)).toMatchObject({
      hotRoomCount: 0,
      evictedCount: 1,
    });
  });

  it('does not evict a room with active sockets', async () => {
    const syncRooms = new Map<string, SyncRoom>();
    await getOrCreateSyncRoom(makeDb(), syncRooms, 'room-1');

    const evicted = evictIdleSyncRooms(syncRooms, {
      idleTtlMs: 0,
      now: Date.now(),
      hasActiveSockets: (roomId) => roomId === 'room-1',
    });

    expect(evicted).toBe(0);
    expect(syncRooms.has('room-1')).toBe(true);
  });

  it('does not evict a room while a leased task is running', async () => {
    const syncRooms = new Map<string, SyncRoom>();
    const leaseStarted = deferred<void>();
    const releaseLease = deferred<void>();

    const leased = withSyncRoom(makeDb(), syncRooms, 'room-1', async () => {
      leaseStarted.resolve();
      await releaseLease.promise;
    });
    await leaseStarted.promise;

    const evicted = evictIdleSyncRooms(syncRooms, { idleTtlMs: 0, now: Date.now() });
    expect(evicted).toBe(0);
    expect(syncRooms.has('room-1')).toBe(true);

    releaseLease.resolve();
    await leased;
  });

  it('does not let an invalidated pending load delete a newer load', async () => {
    const firstLoad = deferred<unknown>();
    const secondLoad = deferred<unknown>();
    const findUnique = vi
      .fn()
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(secondLoad.promise);
    const db = makeDb(findUnique);
    const syncRooms = new Map<string, SyncRoom>();

    const first = getOrCreateSyncRoom(db, syncRooms, 'room-1');
    deleteSyncRoom(syncRooms, 'room-1');
    const second = getOrCreateSyncRoom(db, syncRooms, 'room-1');

    secondLoad.resolve(makeLoadedRoom(2));
    const newerRoom = await second;
    expect(syncRooms.get('room-1')).toBe(newerRoom);

    firstLoad.resolve(makeLoadedRoom(1));
    await first;

    expect(syncRooms.get('room-1')).toBe(newerRoom);
    expect(newerRoom.getStateSnapshot().documentClock).toBe(2);
    expect(getSyncRoomRegistryMetrics(syncRooms).loadCount).toBe(1);
  });
});

function makeDb(findUnique = vi.fn().mockResolvedValue(makeLoadedRoom())): PrismaClient {
  return {
    room: { findUnique },
    processedRequest: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(),
  } as unknown as PrismaClient;
}

function makeLoadedRoom(documentClock = 0): unknown {
  return {
    documentClock: BigInt(documentClock),
    roomEpoch: 0n,
    processedRequestHistoryStartsAtClock: 0n,
    records: [],
    tombstones: [],
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value?: T | PromiseLike<T>) => void;
} {
  let resolve: (value?: T | PromiseLike<T>) => void = () => undefined;
  const promise = new Promise<T>((innerResolve) => {
    resolve = (value) => innerResolve(value as T | PromiseLike<T>);
  });
  return { promise, resolve };
}
