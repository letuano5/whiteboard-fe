/**
 * Tests for socket JOIN_ROOM handler behavior (P3A-02):
 * cold-path load from DB, warm-path in-memory, DB error resilience,
 * and USER_JOIN broadcast still fires in all cases.
 *
 * Strategy: call `createWhiteboardServer` with a fake io-server and
 * injectable `loadRoomElements` / `getRoomClock` via the `db` dep.
 * We capture the 'connection' handler and simulate JOIN_ROOM events.
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
// Mock DB builder for join path
// ---------------------------------------------------------------------------

function makeMockDb(opts: {
  loadResult?: { elements: Element[]; documentClock: number };
  loadError?: Error;
  clockResult?: number;
  clockError?: Error;
}) {
  const findUnique = vi.fn();

  if (opts.loadError) {
    // First call = include:{records:true} => throw
    findUnique.mockRejectedValueOnce(opts.loadError);
  } else if (opts.loadResult !== undefined) {
    const { elements, documentClock } = opts.loadResult;
    // Simulate room.findUnique with include: {records:true}
    findUnique.mockResolvedValueOnce({
      id: 'room-id',
      documentClock: BigInt(documentClock),
      records: elements.map((el) => ({
        roomId: 'room-id',
        recordId: el.id,
        typeName: el.type,
        state: el,
        recordClock: BigInt(documentClock),
      })),
    });
  }

  if (opts.clockError) {
    findUnique.mockRejectedValueOnce(opts.clockError);
  } else if (opts.clockResult !== undefined) {
    // Simulate room.findUnique with select: {documentClock:true}
    findUnique.mockResolvedValueOnce({ documentClock: BigInt(opts.clockResult) });
  }

  const db = {
    room: { findUnique },
  } as unknown as PrismaClient;

  return { db, findUnique };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const JOIN_PAYLOAD = {
  roomId: 'room-join-test',
  sessionId: 'sess-1',
  name: 'Alice',
  color: '#ff0000',
};

let roomPresence: Map<string, Map<string, Presence>>;
let roomElements: Map<string, Map<string, Element>>;
let autosave: ReturnType<typeof createAutosaveManager>;

beforeEach(() => {
  roomPresence = new Map();
  roomElements = new Map();
  autosave = createAutosaveManager({
    delayMs: 60000,
    getRoomElements: () => [],
    saveRoomElements: vi.fn().mockResolvedValue(null),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// @covers AC-2 (P3A-02) — Warm path: in-memory elements exist, no DB element reload
// ---------------------------------------------------------------------------
describe('AC-2 (P3A-02): warm-path join does NOT call loadRoomElements again', () => {
  it('does not call db.room.findUnique with include:{records} when room already has elements', async () => {
    // Pre-populate in-memory state
    const el = makeElement({ id: 'warm-el-1' });
    roomElements.set(JOIN_PAYLOAD.roomId, new Map([['warm-el-1', el]]));

    const { db, findUnique } = makeMockDb({ clockResult: 3 });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, autosave, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD) => Promise<void>)(JOIN_PAYLOAD);

    // findUnique called exactly once (for getRoomClock, select only) — not include:{records:true}
    expect(findUnique).toHaveBeenCalledTimes(1);
    const call = findUnique.mock.calls[0][0] as {
      select?: { documentClock?: boolean };
      include?: { records?: boolean };
    };
    expect(call.select).toEqual({ documentClock: true });
    expect(call.include).toBeUndefined();
  });

  it('emits ROOM_SNAPSHOT with in-memory elements and DB clock on warm path', async () => {
    const el = makeElement({ id: 'warm-el-2' });
    roomElements.set(JOIN_PAYLOAD.roomId, new Map([['warm-el-2', el]]));

    const { db } = makeMockDb({ clockResult: 5 });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, autosave, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD) => Promise<void>)(JOIN_PAYLOAD);

    expect(socket.emit).toHaveBeenCalledWith(
      WS_EVENTS.ROOM_SNAPSHOT,
      expect.objectContaining({ elements: [el], documentClock: 5 }),
    );
  });
});

// ---------------------------------------------------------------------------
// @covers AC-3 (P3A-02) — Cold path: room not in DB, send empty snapshot
// ---------------------------------------------------------------------------
describe('AC-3 (P3A-02) socket layer: empty DB → ROOM_SNAPSHOT { elements: [], documentClock: 0 }', () => {
  it('emits ROOM_SNAPSHOT with empty elements and clock 0 when DB has no room', async () => {
    // db.room.findUnique returns null (room not found)
    const { db } = makeMockDb({ loadResult: { elements: [], documentClock: 0 } });
    // Override: make findUnique return null for loadRoomElements call
    (db.room.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, autosave, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD) => Promise<void>)(JOIN_PAYLOAD);

    expect(socket.emit).toHaveBeenCalledWith(WS_EVENTS.ROOM_SNAPSHOT, {
      elements: [],
      documentClock: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// Cold path: room in DB with active records
// ---------------------------------------------------------------------------
describe('Cold-path join (AC-1 socket layer): room absent in memory, loads from DB', () => {
  it('populates in-memory elements and sends ROOM_SNAPSHOT with elements and clock', async () => {
    const el = makeElement({ id: 'cold-el-1' });
    const { db } = makeMockDb({ loadResult: { elements: [el], documentClock: 7 } });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, autosave, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD) => Promise<void>)(JOIN_PAYLOAD);

    expect(socket.emit).toHaveBeenCalledWith(
      WS_EVENTS.ROOM_SNAPSHOT,
      expect.objectContaining({ elements: [el], documentClock: 7 }),
    );
    // In-memory state populated
    expect(roomElements.get(JOIN_PAYLOAD.roomId)?.get('cold-el-1')).toEqual(el);
  });
});

// ---------------------------------------------------------------------------
// @covers AC-7 (P3A-02) — DB error is non-fatal
// ---------------------------------------------------------------------------
describe('AC-7 (P3A-02): DB error during join is non-fatal', () => {
  it('still emits ROOM_SNAPSHOT when DB throws (with empty elements, documentClock 0)', async () => {
    const { db } = makeMockDb({ loadError: new Error('DB connection failed') });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, autosave, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    // Should not throw
    await expect(
      (handler as (p: typeof JOIN_PAYLOAD) => Promise<void>)(JOIN_PAYLOAD),
    ).resolves.not.toThrow();

    expect(socket.emit).toHaveBeenCalledWith(
      WS_EVENTS.ROOM_SNAPSHOT,
      expect.objectContaining({ documentClock: 0 }),
    );
  });

  it('still broadcasts USER_JOIN even when DB error occurs during join', async () => {
    const { db } = makeMockDb({ loadError: new Error('DB connection failed') });

    const { ioServer, makeSocket, connect, getHandler, toReturn } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, autosave, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD) => Promise<void>)(JOIN_PAYLOAD);

    // USER_JOIN should still be emitted to the room
    expect(toReturn.emit).toHaveBeenCalledWith(
      WS_EVENTS.USER_JOIN,
      expect.objectContaining({ presences: expect.any(Array) }),
    );
  });
});
