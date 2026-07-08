import type { Server, Socket } from 'socket.io';
import { describe, expect, it, vi } from 'vitest';
import type { Presence } from '@vdt/shared';
import type { PrismaClient } from '@prisma/client';
import type { ResolvedWhiteboardServerDeps } from '../types.js';
import { handleDisconnect } from './disconnect.js';

describe('handleDisconnect', () => {
  it('removes empty room presence without touching persistence', () => {
    const deps = makeDeps();
    deps.roomPresence.set(
      'room-1',
      new Map([['socket-1', { sessionId: 'session-1' } as Presence]]),
    );

    handleDisconnect(makeServer(), makeSocket(), deps);

    expect(deps.roomPresence.has('room-1')).toBe(false);
  });

  it('keeps room presence while other sockets remain', () => {
    const deps = makeDeps();
    deps.roomPresence.set(
      'room-1',
      new Map([
        ['socket-1', { sessionId: 'session-1' } as Presence],
        ['socket-2', { sessionId: 'session-2' } as Presence],
      ]),
    );

    handleDisconnect(makeServer(), makeSocket(), deps);

    expect(deps.roomPresence.get('room-1')?.has('socket-1')).toBe(false);
    expect(deps.roomPresence.get('room-1')?.has('socket-2')).toBe(true);
  });
});

function makeDeps(): ResolvedWhiteboardServerDeps {
  return {
    roomPresence: new Map<string, Map<string, Presence>>(),
    syncRooms: new Map(),
    db: {} as PrismaClient,
  };
}

function makeSocket(): Socket {
  return { id: 'socket-1', data: { roomId: 'room-1', sessionId: 'session-1' } } as Socket;
}

function makeServer(): Server {
  return { to: vi.fn().mockReturnValue({ emit: vi.fn() }) } as unknown as Server;
}
