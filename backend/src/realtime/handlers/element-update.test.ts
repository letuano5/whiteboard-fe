import type { PrismaClient } from '@prisma/client';
import type { Socket } from 'socket.io';
import { describe, expect, it, vi } from 'vitest';
import { WS_EVENTS, type Element, type Presence } from '@vdt/shared';
import type { AppUser } from '../../auth/index.js';
import { createAutosaveManager } from '../../persistence/autosave.js';
import { makeElement } from '../../test/element-fixtures.js';
import { handleElementUpdate } from './element-update.js';

const viewerUser = makeUser('viewer-user');
const editorUser = makeUser('editor-user');
const ownerUser = makeUser('owner-user');

describe('handleElementUpdate room role authorization', () => {
  it('rejects viewer mutations before changing state or broadcasting', async () => {
    const emit = vi.fn();
    const peerEmit = vi.fn();
    const socket = makeSocket(viewerUser, emit, peerEmit);
    const db = makeRoleDb('viewer', viewerUser);
    const autosave = createAutosaveManager({
      delayMs: 60000,
      getRoomElements: () => [],
      saveRoomElements: vi.fn().mockResolvedValue(null),
    });
    const roomElements = new Map<string, Map<string, Element>>();

    await handleElementUpdate(
      socket,
      {
        roomPresence: new Map<string, Map<string, Presence>>(),
        roomElements,
        roomClocks: new Map(),
        autosave,
        db,
      },
      { roomId: 'room-1', elements: [makeElement({ id: 'blocked-el' })] },
    );

    expect(roomElements.get('room-1')).toBeUndefined();
    expect(peerEmit).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(WS_EVENTS.ROOM_ACCESS_ERROR, {
      code: 'room-access/forbidden',
      message: 'Viewers cannot mutate room elements.',
    });
  });

  it('allows editor mutations and broadcasts the committed update', async () => {
    const emit = vi.fn();
    const peerEmit = vi.fn();
    const socket = makeSocket(editorUser, emit, peerEmit);
    const db = makeRoleDb('editor', editorUser, 4);
    const markDirty = vi.fn();
    const autosave = createAutosaveManager({
      delayMs: 60000,
      getRoomElements: () => [],
      saveRoomElements: vi.fn().mockResolvedValue(null),
    });
    autosave.markDirty = markDirty;
    const roomElements = new Map<string, Map<string, Element>>();
    const element = makeElement({ id: 'allowed-el' });

    await handleElementUpdate(
      socket,
      {
        roomPresence: new Map<string, Map<string, Presence>>(),
        roomElements,
        roomClocks: new Map(),
        autosave,
        db,
      },
      { roomId: 'room-1', elements: [element], sessionId: 'session-1' },
    );

    expect(roomElements.get('room-1')?.get('allowed-el')).toEqual(element);
    expect(markDirty).toHaveBeenCalledWith('room-1');
    expect(peerEmit).toHaveBeenCalledWith(WS_EVENTS.ELEMENT_UPDATE, {
      elements: [element],
      sessionId: 'session-1',
      documentClock: 5,
    });
  });
});

function makeSocket(
  user: AppUser,
  emit: ReturnType<typeof vi.fn>,
  peerEmit: ReturnType<typeof vi.fn>,
): Socket {
  return {
    data: {
      auth: {
        identity: {
          provider: user.provider,
          providerSubject: user.providerSubject,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        user,
      },
    },
    emit,
    to: vi.fn().mockReturnValue({ emit: peerEmit }),
  } as unknown as Socket;
}

function makeRoleDb(role: 'editor' | 'viewer', user: AppUser, clock = 0): PrismaClient {
  return {
    room: {
      upsert: vi.fn().mockResolvedValue({
        id: 'room-1',
        ownerId: ownerUser.id,
        members: [
          { roomId: 'room-1', userId: ownerUser.id, role: 'owner', user: ownerUser },
          { roomId: 'room-1', userId: user.id, role, user },
        ],
      }),
      findUnique: vi.fn().mockResolvedValue({ documentClock: BigInt(clock) }),
    },
  } as unknown as PrismaClient;
}

function makeUser(id: string): AppUser {
  return {
    id,
    provider: 'test',
    providerSubject: id,
    email: `${id}@example.com`,
    name: id,
    avatarUrl: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}
