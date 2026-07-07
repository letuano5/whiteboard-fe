import { describe, expect, it } from 'vitest';
import type { Element, Presence } from '@vdt/shared';
import { SyncRoom } from '../sync/index.js';
import { evictIdleHotRooms, touchRoomCache } from './room-cache-gc.js';

describe('evictIdleHotRooms', () => {
  it('evicts idle mirrored room caches', async () => {
    const deps = makeDeps();
    deps.roomElements.set('room-1', new Map());
    deps.roomClocks.set('room-1', 4);
    touchRoomCache(deps.roomElements, 'room-1', 0);

    const result = await evictIdleHotRooms(deps, { idleTtlMs: 10, now: 11 });

    expect(result.roomCaches).toBe(1);
    expect(deps.roomElements.has('room-1')).toBe(false);
    expect(deps.roomClocks.has('room-1')).toBe(false);
  });

  it('keeps room caches while a socket is active', async () => {
    const deps = makeDeps();
    deps.roomPresence.set(
      'room-1',
      new Map([['socket-1', { sessionId: 'session-1' } as Presence]]),
    );
    deps.roomElements.set('room-1', new Map());
    touchRoomCache(deps.roomElements, 'room-1', 0);

    const result = await evictIdleHotRooms(deps, { idleTtlMs: 10, now: 11 });

    expect(result.roomCaches).toBe(0);
    expect(deps.roomElements.has('room-1')).toBe(true);
  });

  it('evicts hot SyncRoom and its mirrored room cache together', async () => {
    const deps = makeDeps();
    deps.syncRooms.set('room-1', new SyncRoom({ roomId: 'room-1' }));
    deps.roomElements.set('room-1', new Map());
    deps.roomClocks.set('room-1', 8);
    touchRoomCache(deps.roomElements, 'room-1', 0);

    const result = await evictIdleHotRooms(deps, { idleTtlMs: 0, now: Date.now() });

    expect(result.syncRooms).toBe(1);
    expect(deps.syncRooms.has('room-1')).toBe(false);
    expect(deps.roomElements.has('room-1')).toBe(false);
    expect(deps.roomClocks.has('room-1')).toBe(false);
  });
});

function makeDeps(): Parameters<typeof evictIdleHotRooms>[0] {
  return {
    roomPresence: new Map<string, Map<string, Presence>>(),
    roomElements: new Map<string, Map<string, Element>>(),
    roomClocks: new Map<string, number>(),
    syncRooms: new Map<string, SyncRoom>(),
  };
}
