import type { PrismaClient } from '@prisma/client';
import type { Socket } from 'socket.io';
import { WS_EVENTS, type Presence } from '@vdt/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRoomDiff } from '../../persistence/room-repository.js';
import { makeElement } from '../../test/element-fixtures.js';
import { SyncRoom } from '../../sync/index.js';
import type { ResolvedWhiteboardServerDeps } from '../types.js';
import { handleRoomDiffRequest } from './room-diff-request.js';

vi.mock('../../persistence/room-repository.js', () => ({
  getRoomDiff: vi.fn(),
}));

describe('handleRoomDiffRequest', () => {
  beforeEach(() => {
    vi.mocked(getRoomDiff).mockReset();
  });

  it('emits ROOM_DIFF for a valid incremental diff request', async () => {
    const emit = vi.fn();
    const deps = makeDeps();
    const changed = makeElement({ id: 'changed' });
    vi.mocked(getRoomDiff).mockResolvedValue({
      mode: 'diff',
      changed: [changed],
      deleted: [{ id: 'deleted' }],
      documentClock: 5,
      serverClock: 5,
      roomEpoch: 0,
      fromClock: 3,
      toClock: 5,
      slotClocks: [],
      hasMore: false,
      pendingRequests: [{ requestId: 'req-1', status: 'processed', serverClock: 5 }],
    });

    await handleRoomDiffRequest(makeSocket(emit, 'room-1'), deps, {
      roomId: 'room-1',
      lastServerClock: 3,
      roomEpoch: 0,
      pendingRequests: [{ requestId: 'req-1', clientClock: 3 }],
    });

    // @covers AC-2, AC-3, AC-4
    expect(getRoomDiff).toHaveBeenCalledWith(deps.db, 'room-1', 3, [], {
      actorId: null,
      pendingRequests: [{ requestId: 'req-1', clientClock: 3 }],
      roomEpoch: 0,
    });
    expect(emit).toHaveBeenCalledWith(
      WS_EVENTS.ROOM_DIFF,
      expect.objectContaining({
        roomId: 'room-1',
        fromClock: 3,
        toClock: 5,
        serverClock: 5,
        roomEpoch: 0,
        changed: [changed],
        deleted: [{ id: 'deleted' }],
        slotClocks: [],
        hasMore: false,
        pendingRequests: [{ requestId: 'req-1', status: 'processed', serverClock: 5 }],
      }),
    );
  });

  it('falls back to ROOM_SNAPSHOT when tombstone history is insufficient', async () => {
    const emit = vi.fn();
    const deps = makeDeps();
    const element = makeElement({ id: 'snapshot-el' });
    vi.mocked(getRoomDiff).mockResolvedValue({
      mode: 'wipe',
      elements: [element],
      documentClock: 8,
      serverClock: 8,
      roomEpoch: 7,
      slotClocks: [],
      processedRequestHistoryStartsAtClock: 0,
    });

    await handleRoomDiffRequest(makeSocket(emit, 'room-1'), deps, {
      roomId: 'room-1',
      fromClock: 2,
    });

    // @covers AC-1, AC-5
    expect(emit).toHaveBeenCalledWith(
      WS_EVENTS.ROOM_SNAPSHOT,
      expect.objectContaining({
        roomId: 'room-1',
        serverClock: 8,
        roomEpoch: 7,
        elements: [element],
        slotClocks: [],
        wipeAll: true,
      }),
    );
  });

  it('rejects a diff request for a room the socket has not joined', async () => {
    const emit = vi.fn();
    const deps = makeDeps();

    await handleRoomDiffRequest(makeSocket(emit, 'room-1'), deps, {
      roomId: 'room-2',
      fromClock: 0,
    });

    expect(getRoomDiff).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(WS_EVENTS.ROOM_ACCESS_ERROR, {
      code: 'room-access/forbidden',
      message: 'Join the room before requesting a diff.',
    });
  });
});

function makeDeps(): ResolvedWhiteboardServerDeps {
  const syncRooms = new Map<string, SyncRoom>();
  syncRooms.set('room-1', new SyncRoom({ roomId: 'room-1' }));
  return {
    roomPresence: new Map<string, Map<string, Presence>>(),
    syncRooms,
    db: {} as PrismaClient,
  };
}

function makeSocket(emit: ReturnType<typeof vi.fn>, joinedRoomId: string): Socket {
  return { emit, data: { roomId: joinedRoomId } } as unknown as Socket;
}
