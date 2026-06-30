import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWhiteboardServer } from '../realtime/whiteboard-server.js';
import { createAutosaveManager } from './autosave.js';
import type { Element, Presence } from '@vdt/shared';
import { WS_EVENTS } from '@vdt/shared';
import { makeElement } from '../test/element-fixtures.js';
import { makeFakeIo } from '../test/fake-socket-io.js';
import type { PrismaClient } from '@prisma/client';

function makeMockDb(documentClock: number | null = null) {
  const findUnique = vi.fn().mockResolvedValue(
    documentClock === null
      ? null
      : {
          documentClock: BigInt(documentClock),
          records: [],
        },
  );

  return {
    db: { room: { findUnique } } as unknown as PrismaClient,
    findUnique,
  };
}

function setup() {
  const roomPresence = new Map<string, Map<string, Presence>>();
  const roomElements = new Map<string, Map<string, Element>>();
  const roomClocks = new Map<string, number>();
  const autosave = createAutosaveManager({
    delayMs: 60000,
    getRoomElements: (roomId) => [...(roomElements.get(roomId)?.values() ?? [])],
    getRoomClock: (roomId) => roomClocks.get(roomId) ?? 0,
    saveRoomElements: vi.fn().mockResolvedValue({ documentClock: 1n }),
  });
  const { db } = makeMockDb(null);

  const { ioServer, makeSocket, connect, getHandler, peerEmit, roomEmit } = makeFakeIo();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createWhiteboardServer(ioServer as any, {
    roomPresence,
    roomElements,
    roomClocks,
    autosave,
    db,
  });
  const socket = makeSocket();
  connect(socket);
  const updateHandler = getHandler(socket, WS_EVENTS.ELEMENT_UPDATE) as (payload: {
    roomId: string;
    elements: Element[];
    sessionId?: string;
  }) => Promise<void>;

  return { roomElements, roomClocks, socket, updateHandler, peerEmit, roomEmit };
}

describe('socket delta clock — ELEMENT_UPDATE broadcast clock', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // @covers AC-1
  it('broadcasts documentClock: 1 for the first single-element update from clock 0', async () => {
    const { updateHandler, peerEmit } = setup();
    const el = makeElement({ id: 'el-1' });

    await updateHandler({ roomId: 'room-1', elements: [el], sessionId: 'session-a' });

    expect(peerEmit).toHaveBeenCalledWith(WS_EVENTS.ELEMENT_UPDATE, {
      elements: [el],
      sessionId: 'session-a',
      documentClock: 1,
    });
  });

  // @covers AC-3
  it('emits consecutive monotonic clocks for two updates in the same room', async () => {
    const { updateHandler, peerEmit } = setup();

    await updateHandler({ roomId: 'room-1', elements: [makeElement({ id: 'el-1' })] });
    await updateHandler({ roomId: 'room-1', elements: [makeElement({ id: 'el-2' })] });

    const updatePayloads = peerEmit.mock.calls
      .filter((call) => call[0] === WS_EVENTS.ELEMENT_UPDATE)
      .map((call) => call[1] as { documentClock: number });
    expect(updatePayloads.map((payload) => payload.documentClock)).toEqual([1, 2]);
  });

  // @covers AC-2
  it('increments documentClock once for a batch containing three elements', async () => {
    const { updateHandler, peerEmit } = setup();
    const elements = [
      makeElement({ id: 'el-1' }),
      makeElement({ id: 'el-2' }),
      makeElement({ id: 'el-3' }),
    ];

    await updateHandler({ roomId: 'room-1', elements });

    expect(peerEmit).toHaveBeenCalledWith(
      WS_EVENTS.ELEMENT_UPDATE,
      expect.objectContaining({ elements, documentClock: 1 }),
    );
  });

  // @covers AC-4
  it('initializes a missing warm-path room clock from persisted Room.documentClock before update', async () => {
    const roomPresence = new Map<string, Map<string, Presence>>();
    const roomElements = new Map<string, Map<string, Element>>();
    const roomClocks = new Map<string, number>();
    const roomId = 'room-warm-clock';
    roomElements.set(roomId, new Map([['existing-el', makeElement({ id: 'existing-el' })]]));
    const autosave = createAutosaveManager({
      delayMs: 60000,
      getRoomElements: () => [],
      getRoomClock: (id) => roomClocks.get(id) ?? 0,
      saveRoomElements: vi.fn().mockResolvedValue(null),
    });
    const { db } = makeMockDb(9);
    const { ioServer, makeSocket, connect, getHandler, peerEmit } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, {
      roomPresence,
      roomElements,
      roomClocks,
      autosave,
      db,
    });
    const socket = makeSocket();
    connect(socket);

    const joinHandler = getHandler(socket, WS_EVENTS.JOIN_ROOM) as (payload: {
      roomId: string;
      sessionId: string;
      name: string;
      color: string;
    }) => Promise<void>;
    await joinHandler({ roomId, sessionId: 'sess-1', name: 'Alice', color: '#f00' });

    const updateHandler = getHandler(socket, WS_EVENTS.ELEMENT_UPDATE) as (payload: {
      roomId: string;
      elements: Element[];
    }) => Promise<void>;
    await updateHandler({ roomId, elements: [makeElement({ id: 'new-el' })] });

    expect(peerEmit).toHaveBeenCalledWith(
      WS_EVENTS.ELEMENT_UPDATE,
      expect.objectContaining({ documentClock: 10 }),
    );
  });

  // @covers AC-4
  it('uses 0 as the missing-room fallback before the first update increment', async () => {
    const { updateHandler, peerEmit } = setup();

    await updateHandler({
      roomId: 'room-without-memory-clock',
      elements: [makeElement({ id: 'el-1' })],
    });

    expect(peerEmit).toHaveBeenCalledWith(
      WS_EVENTS.ELEMENT_UPDATE,
      expect.objectContaining({ documentClock: 1 }),
    );
  });

  // @covers AC-4
  it('loads persisted Room.documentClock before a first update when no in-memory clock exists', async () => {
    const roomPresence = new Map<string, Map<string, Presence>>();
    const roomElements = new Map<string, Map<string, Element>>();
    const roomClocks = new Map<string, number>();
    const roomId = 'room-first-update-clock';
    const autosave = createAutosaveManager({
      delayMs: 60000,
      getRoomElements: () => [],
      getRoomClock: (id) => roomClocks.get(id) ?? 0,
      saveRoomElements: vi.fn().mockResolvedValue(null),
    });
    const { db } = makeMockDb(12);
    const { ioServer, makeSocket, connect, getHandler, peerEmit } = makeFakeIo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWhiteboardServer(ioServer as any, {
      roomPresence,
      roomElements,
      roomClocks,
      autosave,
      db,
    });
    const socket = makeSocket();
    connect(socket);

    const updateHandler = getHandler(socket, WS_EVENTS.ELEMENT_UPDATE) as (payload: {
      roomId: string;
      elements: Element[];
    }) => Promise<void>;
    await updateHandler({ roomId, elements: [makeElement({ id: 'first-update-el' })] });

    expect(peerEmit).toHaveBeenCalledWith(
      WS_EVENTS.ELEMENT_UPDATE,
      expect.objectContaining({ documentClock: 13 }),
    );
  });
});

describe('socket delta clock — no periodic full-resync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // @covers AC-7
  it('does not emit ROOM_RESYNC or full element-update while clients are idle for 30 seconds', async () => {
    const { roomEmit, peerEmit } = setup();

    await vi.advanceTimersByTimeAsync(30_001);

    expect(roomEmit).not.toHaveBeenCalledWith(WS_EVENTS.ROOM_RESYNC, expect.anything());
    expect(peerEmit).not.toHaveBeenCalledWith(WS_EVENTS.ROOM_RESYNC, expect.anything());
    expect(peerEmit).not.toHaveBeenCalledWith(WS_EVENTS.ELEMENT_UPDATE, expect.anything());
  });
});
