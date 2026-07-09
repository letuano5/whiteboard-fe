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
import type { Element, Presence } from '@vdt/shared';
import { WS_EVENTS } from '@vdt/shared';
import { makeElement } from '../test/element-fixtures.js';
import { makeFakeIo } from '../test/fake-socket-io.js';
import type { PrismaClient } from '@prisma/client';
import { SyncRoom } from '../sync/index.js';

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
        slotClocks: {},
      })),
      tombstones: [],
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
let syncRooms: Map<string, SyncRoom>;

beforeEach(() => {
  roomPresence = new Map();
  syncRooms = new Map();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// @covers AC-2 (P3A-02) — Warm path: SyncRoom exists, no DB element reload
// ---------------------------------------------------------------------------
describe('AC-2 (P3A-02): warm-path join reuses hot SyncRoom', () => {
  it('does not call db.room.findUnique when a hot SyncRoom already exists', async () => {
    const el = makeElement({ id: 'warm-el-1' });
    syncRooms.set(
      JOIN_PAYLOAD.roomId,
      new SyncRoom({ roomId: JOIN_PAYLOAD.roomId, elements: [el], documentClock: 3 }),
    );

    const { db, findUnique } = makeMockDb({});

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, syncRooms, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD) => Promise<void>)(JOIN_PAYLOAD);

    expect(findUnique).not.toHaveBeenCalled();
  });

  it('emits ROOM_SNAPSHOT with hot SyncRoom elements and clock on warm path', async () => {
    const el = makeElement({ id: 'warm-el-2' });
    syncRooms.set(
      JOIN_PAYLOAD.roomId,
      new SyncRoom({ roomId: JOIN_PAYLOAD.roomId, elements: [el], documentClock: 5 }),
    );

    const { db } = makeMockDb({});

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, syncRooms, db });

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
    createWhiteboardServer(ioServer as any, { roomPresence, syncRooms, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD) => Promise<void>)(JOIN_PAYLOAD);

    expect(socket.emit).toHaveBeenCalledWith(
      WS_EVENTS.ROOM_SNAPSHOT,
      expect.objectContaining({
        elements: [],
        documentClock: 0,
        serverClock: 0,
        roomEpoch: 0,
        slotClocks: [],
      }),
    );
  });

  it('uses the server socket id instead of the client-supplied session id for presence', async () => {
    roomPresence.set(
      JOIN_PAYLOAD.roomId,
      new Map([
        [
          'socket-existing',
          {
            sessionId: 'existing-session',
            name: 'Existing',
            color: '#111111',
            cursor: null,
            selectedIds: [],
            status: 'active',
          },
        ],
      ]),
    );
    const { db } = makeMockDb({});
    const { ioServer, makeSocket, connect, getHandler, peerEmit } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, syncRooms, db });

    const socket = makeSocket({ socketId: 'server-socket-id' });
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD) => Promise<void>)({
      ...JOIN_PAYLOAD,
      sessionId: 'spoofed-peer-session',
    });

    expect(socket.data.sessionId).toBe('server-socket-id');
    expect(roomPresence.get(JOIN_PAYLOAD.roomId)?.get(socket.id)).toMatchObject({
      sessionId: 'server-socket-id',
    });
    expect(socket.emit).toHaveBeenCalledWith(WS_EVENTS.USER_JOIN, {
      presences: [expect.objectContaining({ sessionId: 'existing-session' })],
    });
    expect(peerEmit).toHaveBeenCalledWith(WS_EVENTS.USER_JOIN, {
      presences: [expect.objectContaining({ sessionId: 'server-socket-id' })],
    });
    expect(peerEmit).not.toHaveBeenCalledWith(
      WS_EVENTS.USER_JOIN,
      expect.objectContaining({
        presences: expect.arrayContaining([
          expect.objectContaining({ sessionId: 'spoofed-peer-session' }),
        ]),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Cold path: room in DB with active records
// ---------------------------------------------------------------------------
describe('Cold-path join (AC-1 socket layer): room absent in memory, loads from DB', () => {
  it('populates SyncRoom and sends ROOM_SNAPSHOT with elements and clock', async () => {
    const el = makeElement({ id: 'cold-el-1' });
    const { db } = makeMockDb({ loadResult: { elements: [el], documentClock: 7 } });

    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, syncRooms, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD) => Promise<void>)(JOIN_PAYLOAD);

    expect(socket.emit).toHaveBeenCalledWith(
      WS_EVENTS.ROOM_SNAPSHOT,
      expect.objectContaining({ elements: [el], documentClock: 7 }),
    );
    expect(
      syncRooms.get(JOIN_PAYLOAD.roomId)?.getStateSnapshot().elements.get('cold-el-1'),
    ).toEqual(el);
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
    createWhiteboardServer(ioServer as any, { roomPresence, syncRooms, db });

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

    const { ioServer, makeSocket, connect, getHandler, peerEmit } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, syncRooms, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD) => Promise<void>)(JOIN_PAYLOAD);

    // USER_JOIN should still be emitted to peers.
    expect(peerEmit).toHaveBeenCalledWith(
      WS_EVENTS.USER_JOIN,
      expect.objectContaining({ presences: expect.any(Array) }),
    );
  });
});

describe('P4-03 admission control on socket join', () => {
  it('rejects a new participant when maxParticipants is full', async () => {
    // @covers AC-3
    roomPresence.set(
      JOIN_PAYLOAD.roomId,
      new Map([
        [
          'socket-existing',
          {
            sessionId: 'existing-session',
            name: 'Existing',
            color: '#111111',
            cursor: null,
            selectedIds: [],
            status: 'active',
            baseRole: 'viewer',
            effectiveRole: 'viewer',
          },
        ],
      ]),
    );
    const { db } = makeAccessDb(makeAccessRoom({ visibility: 'link_view', maxParticipants: 1 }));
    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, syncRooms, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD) => Promise<void>)(JOIN_PAYLOAD);

    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(WS_EVENTS.ROOM_ACCESS_ERROR, {
      code: 'room-access/room-full',
      message: 'Room participant limit reached.',
    });
  });

  it('admits an eligible editor as viewer when maxEditors is full and exposes roles in presence', async () => {
    // @covers AC-4
    // @covers AC-5
    roomPresence.set(
      JOIN_PAYLOAD.roomId,
      new Map([
        [
          'socket-existing',
          {
            sessionId: 'existing-editor',
            name: 'Existing editor',
            color: '#111111',
            cursor: null,
            selectedIds: [],
            status: 'active',
            baseRole: 'editor',
            effectiveRole: 'editor',
          },
        ],
      ]),
    );
    const { db } = makeAccessDb(makeAccessRoom({ visibility: 'link_edit', maxEditors: 1 }));
    const { ioServer, makeSocket, connect, getHandler, peerEmit } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, { roomPresence, syncRooms, db });

    const socket = makeSocket();
    connect(socket);

    const handler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await (handler as (p: typeof JOIN_PAYLOAD) => Promise<void>)(JOIN_PAYLOAD);

    expect(socket.emit).toHaveBeenCalledWith(
      WS_EVENTS.ROOM_ACCESS,
      expect.objectContaining({ baseRole: 'editor', effectiveRole: 'viewer', maxEditors: 1 }),
    );
    expect(roomPresence.get(JOIN_PAYLOAD.roomId)?.get(socket.id)).toMatchObject({
      baseRole: 'editor',
      effectiveRole: 'viewer',
    });
    expect(peerEmit).toHaveBeenCalledWith(
      WS_EVENTS.USER_JOIN,
      expect.objectContaining({
        presences: expect.arrayContaining([
          expect.objectContaining({ sessionId: socket.id, effectiveRole: 'viewer' }),
        ]),
      }),
    );
  });
});

function makeAccessDb(room: ReturnType<typeof makeAccessRoom>) {
  return {
    db: {
      room: {
        findUnique: vi.fn().mockResolvedValue(room),
      },
      roomInvitation: {},
    } as unknown as PrismaClient,
  };
}

function makeAccessRoom(
  overrides: Partial<{
    visibility: string;
    locked: boolean;
    maxParticipants: number | null;
    maxEditors: number | null;
  }> = {},
) {
  return {
    id: JOIN_PAYLOAD.roomId,
    name: 'Room',
    workspaceId: null,
    ownerId: null,
    visibility: overrides.visibility ?? 'private',
    shareRevokedAt: null,
    locked: overrides.locked ?? false,
    maxParticipants: overrides.maxParticipants ?? null,
    maxEditors: overrides.maxEditors ?? null,
    archivedAt: null,
    lastOpenedAt: null,
    createdBy: null,
    documentClock: 0n,
    tombstoneHistoryStartsAtClock: 0n,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    members: [],
    invitations: [],
    records: [],
  };
}
