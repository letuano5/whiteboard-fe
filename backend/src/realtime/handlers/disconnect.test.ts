import type { Server, Socket } from 'socket.io';
import { describe, expect, it, vi } from 'vitest';
import type { Element, Presence } from '@vdt/shared';
import type { PrismaClient } from '@prisma/client';
import type { ResolvedWhiteboardServerDeps } from '../types.js';
import { SyncRoom } from '../../sync/index.js';
import { handleDisconnect } from './disconnect.js';

describe('handleDisconnect', () => {
  it('does not run legacy autosave flush for rooms managed by SyncRoom', () => {
    // @covers C2
    const flushRoomNow = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps(flushRoomNow);
    deps.roomPresence.set(
      'room-1',
      new Map([['socket-1', { sessionId: 'session-1' } as Presence]]),
    );
    deps.syncRooms.set('room-1', new SyncRoom({ roomId: 'room-1' }));

    handleDisconnect(makeServer(), makeSocket(), deps);

    expect(flushRoomNow).not.toHaveBeenCalled();
  });

  it('keeps legacy autosave flush for non-P5 rooms', () => {
    const flushRoomNow = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps(flushRoomNow);
    deps.roomPresence.set(
      'room-1',
      new Map([['socket-1', { sessionId: 'session-1' } as Presence]]),
    );

    handleDisconnect(makeServer(), makeSocket(), deps);

    expect(flushRoomNow).toHaveBeenCalledWith('room-1');
  });
});

function makeDeps(flushRoomNow: ReturnType<typeof vi.fn>): ResolvedWhiteboardServerDeps {
  return {
    roomPresence: new Map<string, Map<string, Presence>>(),
    roomElements: new Map<string, Map<string, Element>>(),
    roomClocks: new Map(),
    syncRooms: new Map(),
    autosave: {
      markDirty: vi.fn(),
      flushRoomNow,
    },
    db: {} as PrismaClient,
  };
}

function makeSocket(): Socket {
  return { id: 'socket-1', data: { roomId: 'room-1', sessionId: 'session-1' } } as Socket;
}

function makeServer(): Server {
  return { to: vi.fn().mockReturnValue({ emit: vi.fn() }) } as unknown as Server;
}
