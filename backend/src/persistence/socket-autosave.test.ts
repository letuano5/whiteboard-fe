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
import { createWhiteboardServer } from '../realtime/whiteboard-server.js';
import { createAutosaveManager } from './autosave.js';
import type { Element, Presence } from '@vdt/shared';
import { WS_EVENTS } from '@vdt/shared';
import { makeElement } from '../test/element-fixtures.js';
import { makeFakeIo } from '../test/fake-socket-io.js';
import type { PrismaClient } from '@prisma/client';

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

  it('updates in-memory state without awaiting the slow database write', async () => {
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
    createWhiteboardServer(ioServer as any, {
      roomPresence,
      roomElements,
      roomClocks,
      autosave,
      db: { room: { findUnique: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient,
    });

    const socket = makeSocket({ roomId, sessionId: 'session-1' });
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.ELEMENT_UPDATE) as (payload: {
      roomId: string;
      elements: Element[];
      sessionId?: string;
    }) => Promise<void>;

    const el = makeElement({ id: 'el-1' });

    // Act — synchronous call; persistence is never-resolving (simulates slow DB)
    await handler({ roomId, elements: [el], sessionId: 'session-1' });

    // Assert: in-memory state updated immediately (synchronous, no await)
    expect(roomElements.get(roomId)?.get('el-1')).toEqual(el);
  });

  it('broadcasts the element-update to peers without waiting for the database write', async () => {
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
    createWhiteboardServer(ioServer as any, {
      roomPresence,
      roomElements,
      roomClocks,
      autosave,
      db: { room: { findUnique: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient,
    });

    const socket = makeSocket({ roomId, sessionId: 'session-1' });
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.ELEMENT_UPDATE) as (payload: {
      roomId: string;
      elements: Element[];
      sessionId?: string;
    }) => Promise<void>;

    const el = makeElement({ id: 'el-broadcast' });

    // Act
    await handler({ roomId, elements: [el], sessionId: 'session-1' });

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

  it('in-memory state reflects latest element version after multiple updates', async () => {
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
    createWhiteboardServer(ioServer as any, {
      roomPresence,
      roomElements,
      roomClocks,
      autosave,
      db: { room: { findUnique: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient,
    });

    const socket = makeSocket({ roomId, sessionId: 'session-1' });
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.ELEMENT_UPDATE) as (payload: {
      roomId: string;
      elements: Element[];
    }) => Promise<void>;

    const v1 = makeElement({ id: 'el-X', version: 1 });
    const v2 = makeElement({ id: 'el-X', version: 2, x: 50 });

    await handler({ roomId, elements: [v1] });
    await handler({ roomId, elements: [v2] });

    // Latest version must win (last-write-wins)
    expect(roomElements.get(roomId)?.get('el-X')).toEqual(v2);
  });
});
