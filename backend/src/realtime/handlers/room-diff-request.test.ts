import type { PrismaClient } from '@prisma/client';
import type { Socket } from 'socket.io';
import { WS_EVENTS, type Element, type Presence } from '@vdt/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRoomDiff } from '../../persistence/room-repository.js';
import { makeElement } from '../../test/element-fixtures.js';
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
    });

    await handleRoomDiffRequest(makeSocket(emit), deps, { roomId: 'room-1', fromClock: 3 });

    expect(getRoomDiff).toHaveBeenCalledWith(deps.db, 'room-1', 3, []);
    expect(emit).toHaveBeenCalledWith(WS_EVENTS.ROOM_DIFF, {
      changed: [changed],
      deleted: [{ id: 'deleted' }],
      documentClock: 5,
    });
  });

  it('falls back to ROOM_SNAPSHOT when tombstone history is insufficient', async () => {
    const emit = vi.fn();
    const deps = makeDeps();
    const element = makeElement({ id: 'snapshot-el' });
    vi.mocked(getRoomDiff).mockResolvedValue({
      mode: 'wipe',
      elements: [element],
      documentClock: 8,
    });

    await handleRoomDiffRequest(makeSocket(emit), deps, { roomId: 'room-1', fromClock: 2 });

    expect(emit).toHaveBeenCalledWith(WS_EVENTS.ROOM_SNAPSHOT, {
      elements: [element],
      documentClock: 8,
    });
  });
});

function makeDeps(): ResolvedWhiteboardServerDeps {
  return {
    roomPresence: new Map<string, Map<string, Presence>>(),
    roomElements: new Map<string, Map<string, Element>>(),
    roomClocks: new Map(),
    syncRooms: new Map(),
    autosave: {
      markDirty: vi.fn(),
      flushRoomNow: vi.fn(),
    },
    db: {} as PrismaClient,
  };
}

function makeSocket(emit: ReturnType<typeof vi.fn>): Socket {
  return { emit } as unknown as Socket;
}
