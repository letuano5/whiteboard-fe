import type { PrismaClient } from '@prisma/client';
import type { Socket } from 'socket.io';
import {
  SYNC_PROTOCOL_VERSION,
  SYNC_SCHEMA_VERSION,
  WS_EVENTS,
  type CreateElementCommand,
  type Element,
  type Presence,
  type ReplaceDocumentCommand,
} from '@vdt/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeElement } from '../../test/element-fixtures.js';
import { SyncRoom, SyncRoomPersistenceError } from '../../sync/index.js';
import type { SyncRoomPersistence } from '../../sync/index.js';
import type { ResolvedWhiteboardServerDeps } from '../types.js';
import { handleSyncCommand } from './sync-command.js';

describe('handleSyncCommand', () => {
  const markDirty = vi.fn();

  beforeEach(() => {
    markDirty.mockReset();
  });

  it('ACKs the sender, broadcasts the committed change-set, and mirrors hot room state', async () => {
    const emit = vi.fn();
    const peerEmit = vi.fn();
    const socket = makeSocket(emit, peerEmit);
    const deps = makeDeps(markDirty);
    const element = makeElement({ id: 'created-shape' });

    await handleSyncCommand(socket, deps, createCommand('create-1', element));

    expect(emit).toHaveBeenCalledWith(
      WS_EVENTS.SYNC_ACK,
      expect.objectContaining({
        status: 'commit',
        requestId: 'create-1',
        serverClock: 1,
      }),
    );
    expect(peerEmit).toHaveBeenCalledWith(
      WS_EVENTS.SYNC_BROADCAST,
      expect.objectContaining({
        roomId: 'room-1',
        serverClock: 1,
        changeSet: expect.objectContaining({
          requestId: 'create-1',
          puts: [expect.objectContaining({ id: 'created-shape' })],
        }),
      }),
    );
    expect(deps.roomElements.get('room-1')?.get('created-shape')).toEqual(
      expect.objectContaining({ id: 'created-shape' }),
    );
    expect(deps.roomClocks.get('room-1')).toBe(1);
    expect(markDirty).toHaveBeenCalledWith('room-1');
  });

  it('replays the ACK on a duplicate request without re-broadcasting or re-marking dirty', async () => {
    // @covers AC-3
    const emit = vi.fn();
    const peerEmit = vi.fn();
    const socket = makeSocket(emit, peerEmit);
    const deps = makeDeps(markDirty);
    const command = createCommand('create-dup', makeElement({ id: 'dup-shape' }));

    await handleSyncCommand(socket, deps, command);
    await handleSyncCommand(socket, deps, command);

    const ackCalls = emit.mock.calls.filter(([event]) => event === WS_EVENTS.SYNC_ACK);
    expect(ackCalls).toHaveLength(2);
    expect(ackCalls[1][1]).toEqual(
      expect.objectContaining({ status: 'commit', requestId: 'create-dup', serverClock: 1 }),
    );
    // The replay must not double-commit side effects.
    expect(peerEmit).toHaveBeenCalledTimes(1);
    expect(markDirty).toHaveBeenCalledTimes(1);
  });

  it('rejects viewer commands as sync ACKs without broadcasting or marking dirty', async () => {
    const emit = vi.fn();
    const peerEmit = vi.fn();
    const socket = makeSocket(emit, peerEmit);
    socket.data.roomRole = 'viewer';
    const deps = makeDeps(markDirty);

    await handleSyncCommand(
      socket,
      deps,
      createCommand('blocked-1', makeElement({ id: 'blocked' })),
    );

    expect(emit).toHaveBeenCalledWith(
      WS_EVENTS.SYNC_ACK,
      expect.objectContaining({
        status: 'reject',
        requestId: 'blocked-1',
        reason: 'FORBIDDEN',
      }),
    );
    expect(peerEmit).not.toHaveBeenCalled();
    expect(markDirty).not.toHaveBeenCalled();
    expect(deps.roomElements.get('room-1')).toBeUndefined();
  });

  it('broadcasts one authoritative room-replaced payload for replace-document commits', async () => {
    // @covers AC-2
    const emit = vi.fn();
    const peerEmit = vi.fn();
    const socket = makeSocket(emit, peerEmit);
    const deps = makeDeps(markDirty);
    deps.syncRooms.set(
      'room-1',
      new SyncRoom({
        roomId: 'room-1',
        elements: [makeElement({ id: 'old-shape' })],
        documentClock: 4,
      }),
    );
    const replacement = makeElement({ id: 'replacement-shape', zIndex: 2 });

    await handleSyncCommand(socket, deps, createReplaceCommand('replace-1', [replacement]));

    expect(emit).toHaveBeenCalledWith(
      WS_EVENTS.SYNC_ACK,
      expect.objectContaining({
        status: 'commit',
        requestId: 'replace-1',
        serverClock: 5,
      }),
    );
    const roomReplacedCalls = peerEmit.mock.calls.filter(
      ([event]) => event === WS_EVENTS.ROOM_REPLACED,
    );
    expect(roomReplacedCalls).toHaveLength(1);
    expect(roomReplacedCalls[0][1]).toEqual(
      expect.objectContaining({
        roomId: 'room-1',
        serverClock: 5,
        roomEpoch: 1,
        elements: [expect.objectContaining({ id: 'replacement-shape' })],
      }),
    );
    expect(deps.roomElements.get('room-1')?.has('old-shape')).toBe(false);
    expect(deps.roomElements.get('room-1')?.get('replacement-shape')).toEqual(
      expect.objectContaining({ id: 'replacement-shape' }),
    );
  });

  it('does not ACK or broadcast when persistence fails before commit', async () => {
    // @covers AC-6
    const emit = vi.fn();
    const peerEmit = vi.fn();
    const socket = makeSocket(emit, peerEmit);
    const deps = makeDeps(markDirty);
    deps.syncRooms.set(
      'room-1',
      new SyncRoom({
        roomId: 'room-1',
        persistence: failingPersistence(new Error('db unavailable')),
      }),
    );

    await handleSyncCommand(socket, deps, createCommand('db-fail', makeElement({ id: 'shape' })));

    expect(emit).not.toHaveBeenCalledWith(WS_EVENTS.SYNC_ACK, expect.anything());
    expect(peerEmit).not.toHaveBeenCalled();
    expect(markDirty).not.toHaveBeenCalled();
    expect(deps.roomElements.get('room-1')).toBeUndefined();
  });

  it('does not ACK or broadcast when conditional clock conflict marks the room unhealthy', async () => {
    // @covers AC-8
    const emit = vi.fn();
    const peerEmit = vi.fn();
    const socket = makeSocket(emit, peerEmit);
    const deps = makeDeps(markDirty);
    deps.syncRooms.set(
      'room-1',
      new SyncRoom({
        roomId: 'room-1',
        persistence: failingPersistence(
          new SyncRoomPersistenceError('CONDITIONAL_CLOCK_CONFLICT'),
          { documentClock: 9 },
        ),
      }),
    );

    await handleSyncCommand(
      socket,
      deps,
      createCommand('clock-conflict', makeElement({ id: 'shape' })),
    );

    expect(emit).not.toHaveBeenCalledWith(WS_EVENTS.SYNC_ACK, expect.anything());
    expect(peerEmit).not.toHaveBeenCalled();
    expect(markDirty).not.toHaveBeenCalled();
    expect(deps.roomClocks.get('room-1')).toBeUndefined();
  });
});

function createCommand(requestId: string, element: Element): CreateElementCommand {
  return {
    kind: 'create-element',
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId: 'room-1',
    requestId,
    clientClock: 1,
    baseRoomEpoch: 0,
    element,
  };
}

function createReplaceCommand(requestId: string, elements: Element[]): ReplaceDocumentCommand {
  return {
    kind: 'replace-document',
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId: 'room-1',
    requestId,
    clientClock: 4,
    baseRoomEpoch: 0,
    elements,
    reason: 'import',
  };
}

function makeDeps(markDirty: (roomId: string) => void): ResolvedWhiteboardServerDeps {
  return {
    roomPresence: new Map<string, Map<string, Presence>>(),
    roomElements: new Map<string, Map<string, Element>>(),
    roomClocks: new Map(),
    syncRooms: new Map(),
    autosave: {
      markDirty,
      flushRoomNow: vi.fn(),
    },
    db: makeTestDb(),
  };
}

function makeTestDb(): PrismaClient {
  const txMock = {
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    room: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    record: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    tombstone: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    processedRequest: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
  };
  return {
    room: { findUnique: vi.fn().mockResolvedValue(null) },
    processedRequest: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) =>
      fn(txMock),
    ),
  } as unknown as PrismaClient;
}

function makeSocket(emit: ReturnType<typeof vi.fn>, peerEmit: ReturnType<typeof vi.fn>): Socket {
  return {
    data: {},
    emit,
    to: vi.fn().mockReturnValue({ emit: peerEmit }),
  } as unknown as Socket;
}

function failingPersistence(
  error: Error,
  reloadState: { documentClock: number } = { documentClock: 0 },
): SyncRoomPersistence {
  return {
    findProcessedRequest: vi.fn().mockResolvedValue(null),
    commitChangeSet: vi.fn().mockRejectedValue(error),
    reloadState: vi.fn().mockResolvedValue({
      elements: [],
      documentClock: reloadState.documentClock,
      roomEpoch: 0,
      slotClocks: [],
      tombstoneElementIds: [],
    }),
  };
}
