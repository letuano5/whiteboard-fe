/**
 * Integration tests for the JOIN_ROOM reconnect-diff path (P3A-03).
 *
 * Strategy: inject a fake Prisma db that returns controlled aggregate/findMany/findUnique
 * results, then simulate JOIN_ROOM with lastServerClock > 0 via createWhiteboardServer.
 *
 * @covers AC-1 Server returns incremental diff for valid clock
 * @covers AC-2 Deleted elements are in diff.deleted
 * @covers AC-4 New client with clock 0 receives full snapshot (not ROOM_DIFF)
 * @covers AC-8 Wipe-all returned when tombstone history is insufficient
 * @covers AC-9 Wipe-all snapshot matches full room state
 * @covers AC-10 No wipe-all when room has no tombstones
 * @covers AC-12 ROOM_DIFF is a distinct WS event from ROOM_SNAPSHOT
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWhiteboardServer } from '../realtime/whiteboard-server.js';
import { createAutosaveManager } from './autosave.js';
import type { Element, Presence } from '@vdt/shared';
import { WS_EVENTS } from '@vdt/shared';
import { makeElement } from '../test/element-fixtures.js';
import type { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Fake io-server helpers (reused from socket-join.test.ts pattern)
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

  const toReturn = {
    emit: vi.fn(),
  };

  const ioServer = {
    on: vi.fn((event: string, handler: ConnectionHandler) => {
      if (event === 'connection') {
        connectionHandler = handler;
      }
    }),
    to: vi.fn().mockReturnValue(toReturn),
  };

  function makeSocket(socketId = 'socket-1'): FakeSocket {
    return {
      id: socketId,
      data: { sessionId: '', roomId: '' },
      join: vi.fn(),
      emit: vi.fn(),
      to: vi.fn().mockReturnValue({ emit: vi.fn() }),
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

  return { ioServer, makeSocket, connect, getHandler, toReturn };
}

// ---------------------------------------------------------------------------
// DB mock builder for the reconnect-diff path
// ---------------------------------------------------------------------------

/**
 * Builds a PrismaClient mock for the full reconnect-diff path.
 *
 * Covers calls made by:
 * 1. getRoomClock (warm path): room.findUnique select:{documentClock}
 * 2. getRoomDiff:
 *    a. tombstone.aggregate(_min: deletedClock)
 *    b. room.findUnique select:{documentClock}
 *    c. record.findMany (diff path only)
 *    d. tombstone.findMany (diff path only)
 */
function makeDiffMockDb(opts: {
  /** For the warm-path getRoomClock call (room.findUnique with select:{documentClock}) */
  documentClock: number;
  /** For tombstone.aggregate: MIN(deletedClock). null = no tombstones. */
  minDeletedClock: bigint | null;
  /** Records returned by record.findMany (changed since lastServerClock) */
  changedRecords?: Array<{ state: unknown; recordClock: bigint }>;
  /** Tombstones returned by tombstone.findMany (deleted since lastServerClock) */
  deletedTombstones?: Array<{ recordId: string }>;
}) {
  const clock = BigInt(opts.documentClock);

  // room.findUnique may be called multiple times: once for getRoomClock, once inside getRoomDiff.
  const roomFindUnique = vi
    .fn()
    .mockResolvedValue({ documentClock: clock });

  const tombstoneAggregate = vi.fn().mockResolvedValue({
    _min: { deletedClock: opts.minDeletedClock },
  });

  const recordFindMany = vi
    .fn()
    .mockResolvedValue(opts.changedRecords ?? []);

  const tombstoneFindMany = vi
    .fn()
    .mockResolvedValue(opts.deletedTombstones ?? []);

  const db = {
    room: { findUnique: roomFindUnique },
    tombstone: { aggregate: tombstoneAggregate, findMany: tombstoneFindMany },
    record: { findMany: recordFindMany },
  } as unknown as PrismaClient;

  return { db, roomFindUnique, tombstoneAggregate, recordFindMany, tombstoneFindMany };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const ROOM_ID = 'room-reconnect-test';

const JOIN_PAYLOAD_BASE = {
  roomId: ROOM_ID,
  sessionId: 'sess-reconnect-1',
  name: 'Bob',
  color: '#00ff00',
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
// Helper: pre-populate in-memory room elements (warm path)
// ---------------------------------------------------------------------------
function seedRoom(elements: Element[]): void {
  const m = new Map<string, Element>();
  for (const el of elements) m.set(el.id, el);
  roomElements.set(ROOM_ID, m);
}

// ---------------------------------------------------------------------------
// AC-4: lastServerClock = 0 → full ROOM_SNAPSHOT (existing behaviour preserved)
// ---------------------------------------------------------------------------

describe('AC-4: initial join (lastServerClock absent or 0) → ROOM_SNAPSHOT, not ROOM_DIFF', () => {
  // @covers AC-4
  it('emits ROOM_SNAPSHOT when lastServerClock is absent', async () => {
    const el = makeElement({ id: 'el-initial' });
    seedRoom([el]);

    // No diff DB calls expected — just the warm-path clock call
    const { db } = makeDiffMockDb({ documentClock: 3, minDeletedClock: null });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, autosave, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD_BASE) => Promise<void>)(JOIN_PAYLOAD_BASE);

    // Should use ROOM_SNAPSHOT (initial join path)
    const emitCalls = (socket.emit as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, unknown]
    >;
    const snapCall = emitCalls.find((c) => c[0] === WS_EVENTS.ROOM_SNAPSHOT);
    const diffCall = emitCalls.find((c) => c[0] === WS_EVENTS.ROOM_DIFF);

    expect(snapCall).toBeDefined();
    expect(diffCall).toBeUndefined(); // AC-12: no ROOM_DIFF on initial join
  });

  // @covers AC-4
  it('emits ROOM_SNAPSHOT when lastServerClock is 0', async () => {
    const el = makeElement({ id: 'el-zero-clock' });
    seedRoom([el]);

    const { db } = makeDiffMockDb({ documentClock: 5, minDeletedClock: null });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, autosave, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD_BASE & { lastServerClock: number }) => Promise<void>)(
      { ...JOIN_PAYLOAD_BASE, lastServerClock: 0 },
    );

    const emitCalls = (socket.emit as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, unknown]
    >;
    expect(emitCalls.find((c) => c[0] === WS_EVENTS.ROOM_SNAPSHOT)).toBeDefined();
    expect(emitCalls.find((c) => c[0] === WS_EVENTS.ROOM_DIFF)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-1, AC-12: reconnect with valid clock → ROOM_DIFF (incremental, not snapshot)
// ---------------------------------------------------------------------------

describe('AC-1 + AC-12: reconnect with lastServerClock > 0 and sufficient history → ROOM_DIFF', () => {
  // @covers AC-1, AC-12
  it('emits ROOM_DIFF (not ROOM_SNAPSHOT) with changed elements since lastServerClock', async () => {
    // Only seed the changed element in-memory (not the "old" element that was already in DB)
    // so the in-memory overlay doesn't unexpectedly add elements.
    // AC-1: DB-changed records drive the diff; overlay adds not-yet-autosaved in-memory extras.
    const changedEl = makeElement({ id: 'el-changed' });
    seedRoom([changedEl]); // only changed element in memory

    const { db } = makeDiffMockDb({
      documentClock: 10,
      minDeletedClock: null, // no tombstones → always diff mode
      changedRecords: [{ state: changedEl, recordClock: 8n }],
      deletedTombstones: [],
    });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, autosave, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD_BASE & { lastServerClock: number }) => Promise<void>)(
      { ...JOIN_PAYLOAD_BASE, lastServerClock: 5 },
    );

    const emitCalls = (socket.emit as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, unknown]
    >;
    const diffCall = emitCalls.find((c) => c[0] === WS_EVENTS.ROOM_DIFF);
    const snapCall = emitCalls.find((c) => c[0] === WS_EVENTS.ROOM_SNAPSHOT);

    expect(diffCall).toBeDefined(); // AC-12: distinct ROOM_DIFF event
    expect(snapCall).toBeUndefined(); // AC-1: NOT a full snapshot

    const diffPayload = diffCall![1] as {
      changed: Element[];
      deleted: Array<{ id: string }>;
      documentClock: number;
    };
    // AC-1: DB-changed record appears in diff
    expect(diffPayload.changed.map((e) => e.id)).toContain('el-changed');
    expect(diffPayload.documentClock).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// AC-2: deleted elements appear in ROOM_DIFF.deleted
// ---------------------------------------------------------------------------

describe('AC-2: elements deleted while offline appear in ROOM_DIFF.deleted', () => {
  // @covers AC-2
  it('ROOM_DIFF.deleted contains IDs of elements tombstoned since lastServerClock', async () => {
    const activeEl = makeElement({ id: 'el-active' });
    seedRoom([activeEl]);

    const { db } = makeDiffMockDb({
      documentClock: 12,
      minDeletedClock: 3n, // history starts at 3; lastServerClock=3 → 3 >= 3 → diff mode
      changedRecords: [],
      deletedTombstones: [{ recordId: 'el-deleted-1' }, { recordId: 'el-deleted-2' }],
    });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, autosave, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD_BASE & { lastServerClock: number }) => Promise<void>)(
      { ...JOIN_PAYLOAD_BASE, lastServerClock: 3 },
    );

    const emitCalls = (socket.emit as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, unknown]
    >;
    const diffCall = emitCalls.find((c) => c[0] === WS_EVENTS.ROOM_DIFF);
    expect(diffCall).toBeDefined();

    const diffPayload = diffCall![1] as { deleted: Array<{ id: string }> };
    expect(diffPayload.deleted.map((d) => d.id)).toEqual(['el-deleted-1', 'el-deleted-2']);
  });
});

// ---------------------------------------------------------------------------
// AC-8: wipe-all when lastServerClock < MIN(deletedClock)
// ---------------------------------------------------------------------------

describe('AC-8: wipe-all returned when tombstone history is insufficient', () => {
  // @covers AC-8
  it('emits ROOM_SNAPSHOT (not ROOM_DIFF) when lastServerClock=5 and MIN(deletedClock)=8', async () => {
    const el1 = makeElement({ id: 'el-active-1' });
    const el2 = makeElement({ id: 'el-active-2' });
    seedRoom([el1, el2]);

    const { db } = makeDiffMockDb({
      documentClock: 15,
      minDeletedClock: 8n, // history starts at 8; lastServerClock=5 < 8 → wipe-all
      changedRecords: [],
      deletedTombstones: [],
    });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, autosave, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD_BASE & { lastServerClock: number }) => Promise<void>)(
      { ...JOIN_PAYLOAD_BASE, lastServerClock: 5 },
    );

    const emitCalls = (socket.emit as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, unknown]
    >;
    const snapCall = emitCalls.find((c) => c[0] === WS_EVENTS.ROOM_SNAPSHOT);
    const diffCall = emitCalls.find((c) => c[0] === WS_EVENTS.ROOM_DIFF);

    expect(snapCall).toBeDefined(); // wipe-all uses ROOM_SNAPSHOT
    expect(diffCall).toBeUndefined(); // no ROOM_DIFF on wipe-all
  });

  // @covers AC-9: wipe-all snapshot contains all active elements
  it('ROOM_SNAPSHOT from wipe-all contains all currently active room elements', async () => {
    const el1 = makeElement({ id: 'wipe-el-1' });
    const el2 = makeElement({ id: 'wipe-el-2' });
    seedRoom([el1, el2]);

    const { db } = makeDiffMockDb({
      documentClock: 20,
      minDeletedClock: 10n, // lastServerClock=3 < 10 → wipe-all
      changedRecords: [],
      deletedTombstones: [],
    });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, autosave, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD_BASE & { lastServerClock: number }) => Promise<void>)(
      { ...JOIN_PAYLOAD_BASE, lastServerClock: 3 },
    );

    const emitCalls = (socket.emit as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, unknown]
    >;
    const snapCall = emitCalls.find((c) => c[0] === WS_EVENTS.ROOM_SNAPSHOT);
    expect(snapCall).toBeDefined();

    const snapPayload = snapCall![1] as { elements: Element[]; documentClock: number };
    const ids = snapPayload.elements.map((e) => e.id);
    expect(ids).toContain('wipe-el-1');
    expect(ids).toContain('wipe-el-2');
    expect(snapPayload.documentClock).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// AC-10: no tombstones → always diff mode, never wipe-all
// ---------------------------------------------------------------------------

describe('AC-10: room with no tombstones always returns ROOM_DIFF', () => {
  // @covers AC-10
  it('emits ROOM_DIFF (not wipe-all ROOM_SNAPSHOT) when there are no tombstones in the room', async () => {
    const el = makeElement({ id: 'el-nodel' });
    seedRoom([el]);

    const { db } = makeDiffMockDb({
      documentClock: 8,
      minDeletedClock: null, // no tombstones → always diff mode (AC-10)
      changedRecords: [{ state: el, recordClock: 6n }],
      deletedTombstones: [],
    });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, autosave, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD_BASE & { lastServerClock: number }) => Promise<void>)(
      { ...JOIN_PAYLOAD_BASE, lastServerClock: 4 },
    );

    const emitCalls = (socket.emit as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, unknown]
    >;
    const diffCall = emitCalls.find((c) => c[0] === WS_EVENTS.ROOM_DIFF);
    expect(diffCall).toBeDefined(); // AC-10: ROOM_DIFF, not ROOM_SNAPSHOT

    const diffPayload = diffCall![1] as { deleted: Array<{ id: string }> };
    expect(diffPayload.deleted).toHaveLength(0); // no tombstones → no deletions
  });

  // @covers AC-10: even with any lastServerClock value
  it('returns ROOM_DIFF for any valid lastServerClock when there are no tombstones', async () => {
    const el = makeElement({ id: 'el-nodel-2' });
    seedRoom([el]);

    const { db } = makeDiffMockDb({
      documentClock: 100,
      minDeletedClock: null, // no tombstones
      changedRecords: [],
      deletedTombstones: [],
    });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, roomElements, autosave, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    // lastServerClock = 1 (very old)
    await (handler as (p: typeof JOIN_PAYLOAD_BASE & { lastServerClock: number }) => Promise<void>)(
      { ...JOIN_PAYLOAD_BASE, lastServerClock: 1 },
    );

    const emitCalls = (socket.emit as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, unknown]
    >;
    expect(emitCalls.find((c) => c[0] === WS_EVENTS.ROOM_DIFF)).toBeDefined();
    expect(emitCalls.find((c) => c[0] === WS_EVENTS.ROOM_SNAPSHOT)).toBeUndefined();
  });
});
