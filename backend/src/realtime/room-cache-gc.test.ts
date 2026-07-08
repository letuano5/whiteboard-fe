import { describe, expect, it } from 'vitest';
import type { Presence } from '@vdt/shared';
import { SyncRoom } from '../sync/index.js';
import { evictIdleHotRooms } from './room-cache-gc.js';

describe('evictIdleHotRooms', () => {
  it('keeps hot SyncRoom while a socket is active', async () => {
    const deps = makeDeps();
    deps.roomPresence.set(
      'room-1',
      new Map([['socket-1', { sessionId: 'session-1' } as Presence]]),
    );
    deps.syncRooms.set('room-1', new SyncRoom({ roomId: 'room-1' }));

    const result = await evictIdleHotRooms(deps, { idleTtlMs: 10, now: 11 });

    expect(result.syncRooms).toBe(0);
    expect(deps.syncRooms.has('room-1')).toBe(true);
  });

  it('evicts idle hot SyncRoom', async () => {
    const deps = makeDeps();
    deps.syncRooms.set('room-1', new SyncRoom({ roomId: 'room-1' }));

    const result = await evictIdleHotRooms(deps, { idleTtlMs: 0, now: Date.now() });

    expect(result.syncRooms).toBe(1);
    expect(deps.syncRooms.has('room-1')).toBe(false);
  });
});

function makeDeps(): Parameters<typeof evictIdleHotRooms>[0] {
  return {
    roomPresence: new Map<string, Map<string, Presence>>(),
    syncRooms: new Map<string, SyncRoom>(),
  };
}
