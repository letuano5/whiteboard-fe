/**
 * Tests for socket hot-path behavior with a slow/pending autosave.
 * Verifies that realtime broadcasts are not blocked by persistence (AC-8).
 *
 * @covers AC-8  element-update updates in-memory state and broadcasts to peers
 *               without waiting for the database write.
 *
 * Strategy: instead of creating a real Socket.IO server, we call `createWhiteboardServer`
 * with a mock io-server and capture the 'connection' handler.  We then fabricate a fake
 * socket that records `emit` and `to(...).emit` calls so we can assert broadcast behavior
 * without any network I/O.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWhiteboardServer } from '../index.js';
import { createAutosaveManager } from './autosave.js';
import type { Element, Presence } from '@vdt/shared';
import { WS_EVENTS } from '@vdt/shared';
import { makeElement } from '../test/element-fixtures.js';

// ---------------------------------------------------------------------------
// Fake io-server helpers (no real network binding)
// ---------------------------------------------------------------------------

type ConnectionHandler = (socket: FakeSocket) => void;

interface FakeSocket {
  id: string;
  data: { sessionId: string; roomId: string };
  join: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  to: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}

function makeFakeIo() {
  let connectionHandler: ConnectionHandler | null = null;
  const broadcastEmitted: Array<[string, unknown]> = [];

  const toReturn = {
    emit: vi.fn((event: string, payload: unknown) => {
      broadcastEmitted.push([event, payload]);
    }),
  };

  const ioServer = {
    on: vi.fn((event: string, handler: ConnectionHandler) => {
      if (event === 'connection') {
        connectionHandler = handler;
      }
    }),
    to: vi.fn().mockReturnValue(toReturn),
  };

  function makeSocket(roomId = 'room-test', socketId = 'socket-1'): FakeSocket {
    const broadcastTo = {
      emit: vi.fn((event: string, payload: unknown) => {
        broadcastEmitted.push([event, payload]);
      }),
    };
    return {
      id: socketId,
      data: { sessionId: 'session-1', roomId },
      join: vi.fn(),
      emit: vi.fn(),
      to: vi.fn().mockReturnValue(broadcastTo),
      on: vi.fn(),
    };
  }

  function connect(socket: FakeSocket): void {
    if (!connectionHandler) throw new Error('connection handler not registered');
    connectionHandler(socket);
  }

  function getHandler(socket: FakeSocket, event: string) {
    const onCalls = (socket.on as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, (...args: unknown[]) => unknown]
    >;
    const entry = onCalls.find((c) => c[0] === event);
    if (!entry) throw new Error(`No handler registered for '${event}'`);
    return entry[1];
  }

  return { ioServer, makeSocket, connect, getHandler, broadcastEmitted };
}

// ---------------------------------------------------------------------------
// @covers AC-8
// ---------------------------------------------------------------------------
describe('AC-8: hot path — element-update does not block on persistence', () => {
  let roomPresence: Map<string, Map<string, Presence>>;
  let roomElements: Map<string, Map<string, Element>>;
  let roomClocks: Map<string, number>;
  let neverResolves: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    roomPresence = new Map();
    roomElements = new Map();
    roomClocks = new Map();
    neverResolves = vi.fn().mockReturnValue(new Promise(() => {}));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updates in-memory state without awaiting the slow database write', () => {
    const autosave = createAutosaveManager({
      delayMs: 60000,
      getRoomElements: (id) => {
        const m = roomElements.get(id);
        return m ? [...m.values()] : [];
      },
      saveRoomElements: neverResolves,
    });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roomId = 'room-1';
    roomClocks.set(roomId, 0);
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, roomClocks, autosave });

    const socket = makeSocket(roomId);
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.ELEMENT_UPDATE) as (payload: {
      roomId: string;
      elements: Element[];
      sessionId?: string;
    }) => void;

    const el = makeElement({ id: 'el-1' });

    // Act — synchronous call; persistence is never-resolving (simulates slow DB)
    handler({ roomId, elements: [el], sessionId: 'session-1' });

    // Assert: in-memory state updated immediately (synchronous, no await)
    expect(roomElements.get(roomId)?.get('el-1')).toEqual(el);
  });

  it('broadcasts the element-update to peers without waiting for the database write', () => {
    const autosave = createAutosaveManager({
      delayMs: 60000,
      getRoomElements: (id) => {
        const m = roomElements.get(id);
        return m ? [...m.values()] : [];
      },
      saveRoomElements: neverResolves,
    });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roomId = 'room-2';
    roomClocks.set(roomId, 0);
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, roomClocks, autosave });

    const socket = makeSocket(roomId);
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.ELEMENT_UPDATE) as (payload: {
      roomId: string;
      elements: Element[];
      sessionId?: string;
    }) => void;

    const el = makeElement({ id: 'el-broadcast' });

    // Act
    handler({ roomId, elements: [el], sessionId: 'session-1' });

    // Assert: socket.to(roomId).emit was called with ELEMENT_UPDATE immediately
    const toCalls = (socket.to as ReturnType<typeof vi.fn>).mock.calls as Array<[string]>;
    expect(toCalls.length).toBeGreaterThan(0);
    expect(toCalls[0][0]).toBe(roomId);

    const emitCalls = (socket.to(roomId).emit as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, unknown]
    >;
    const updateCall = emitCalls.find((c) => c[0] === WS_EVENTS.ELEMENT_UPDATE);
    expect(updateCall).toBeDefined();
    expect((updateCall![1] as { elements: Element[] }).elements).toContainEqual(el);
  });

  it('in-memory state reflects latest element version after multiple updates', () => {
    const autosave = createAutosaveManager({
      delayMs: 60000,
      getRoomElements: (id) => {
        const m = roomElements.get(id);
        return m ? [...m.values()] : [];
      },
      saveRoomElements: vi.fn().mockResolvedValue({}),
    });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roomId = 'room-3';
    roomClocks.set(roomId, 0);
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, roomClocks, autosave });

    const socket = makeSocket(roomId);
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.ELEMENT_UPDATE) as (payload: {
      roomId: string;
      elements: Element[];
      sessionId?: string;
    }) => void;

    const v1 = makeElement({ id: 'el-X', version: 1 });
    const v2 = makeElement({ id: 'el-X', version: 2, x: 50 });

    handler({ roomId, elements: [v1] });
    handler({ roomId, elements: [v2] });

    // Latest version must win (last-write-wins)
    expect(roomElements.get(roomId)?.get('el-X')).toEqual(v2);
  });

  it('uses the shared LWW nonce tie-breaker for same-version updates', () => {
    const autosave = createAutosaveManager({
      delayMs: 60000,
      getRoomElements: (id) => {
        const m = roomElements.get(id);
        return m ? [...m.values()] : [];
      },
      saveRoomElements: vi.fn().mockResolvedValue({}),
    });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    const roomId = 'room-lww-nonce';
    roomClocks.set(roomId, 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, roomClocks, autosave });

    const socket = makeSocket(roomId);
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.ELEMENT_UPDATE) as (payload: {
      roomId: string;
      elements: Element[];
      sessionId?: string;
    }) => void;

    const current = makeElement({ id: 'el-LWW', version: 2, versionNonce: 700, x: 10 });
    const winner = makeElement({ id: 'el-LWW', version: 2, versionNonce: 100, x: 99 });

    handler({ roomId, elements: [current] });
    handler({ roomId, elements: [winner] });

    expect(roomElements.get(roomId)?.get('el-LWW')).toEqual(winner);
  });

  it('ignores same-version updates with a higher nonce and does not advance documentClock', () => {
    const autosave = createAutosaveManager({
      delayMs: 60000,
      getRoomElements: (id) => {
        const m = roomElements.get(id);
        return m ? [...m.values()] : [];
      },
      saveRoomElements: vi.fn().mockResolvedValue({}),
    });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    const roomId = 'room-lww-discard';
    roomClocks.set(roomId, 5);
    roomElements.set(
      roomId,
      new Map([
        ['el-discard', makeElement({ id: 'el-discard', version: 4, versionNonce: 100, x: 10 })],
      ]),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, roomClocks, autosave });

    const socket = makeSocket(roomId);
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.ELEMENT_UPDATE) as (payload: {
      roomId: string;
      elements: Element[];
    }) => void;

    const loser = makeElement({ id: 'el-discard', version: 4, versionNonce: 900, x: 999 });
    handler({ roomId, elements: [loser] });

    expect(roomElements.get(roomId)?.get('el-discard')?.x).toBe(10);
    expect(roomClocks.get(roomId)).toBe(5);

    const emitCalls = (socket.to(roomId).emit as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, unknown]
    >;
    expect(emitCalls.find((c) => c[0] === WS_EVENTS.ELEMENT_UPDATE)).toBeUndefined();
  });

  it('broadcasts only accepted elements from a mixed LWW batch', () => {
    const autosave = createAutosaveManager({
      delayMs: 60000,
      getRoomElements: (id) => {
        const m = roomElements.get(id);
        return m ? [...m.values()] : [];
      },
      saveRoomElements: vi.fn().mockResolvedValue({}),
    });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    const roomId = 'room-lww-mixed';
    roomClocks.set(roomId, 0);
    roomElements.set(
      roomId,
      new Map([
        ['accepted', makeElement({ id: 'accepted', version: 1, versionNonce: 500, x: 0 })],
        ['rejected', makeElement({ id: 'rejected', version: 3, versionNonce: 100, x: 0 })],
      ]),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, roomClocks, autosave });

    const socket = makeSocket(roomId);
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.ELEMENT_UPDATE) as (payload: {
      roomId: string;
      elements: Element[];
      sessionId?: string;
    }) => void;

    const accepted = makeElement({ id: 'accepted', version: 2, versionNonce: 900, x: 50 });
    const rejected = makeElement({ id: 'rejected', version: 3, versionNonce: 900, x: 999 });
    handler({ roomId, elements: [accepted, rejected], sessionId: 'session-1' });

    expect(roomElements.get(roomId)?.get('accepted')).toEqual(accepted);
    expect(roomElements.get(roomId)?.get('rejected')?.x).toBe(0);

    const emitCalls = (socket.to(roomId).emit as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, unknown]
    >;
    const updateCall = emitCalls.find((c) => c[0] === WS_EVENTS.ELEMENT_UPDATE);
    expect(updateCall).toBeDefined();
    expect((updateCall![1] as { elements: Element[] }).elements).toEqual([accepted]);
  });
});
