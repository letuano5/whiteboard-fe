import type { PrismaClient } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import { describe, expect, it, vi } from 'vitest';
import { WS_EVENTS, type Element, type Presence } from '@vdt/shared';
import type { AppUser } from '../../auth/index.js';
import type { AutosaveManager } from '../../persistence/autosave.js';
import { handleRoomRoleUpdate } from './room-role-update.js';

const ownerUser = makeUser('owner-user');
const memberUser = makeUser('member-user');

describe('handleRoomRoleUpdate', () => {
  it('persists non-owner member role changes and broadcasts room access', async () => {
    const roomEmit = vi.fn();
    const db = makeRoleUpdateDb();

    await handleRoomRoleUpdate(
      { to: vi.fn().mockReturnValue({ emit: roomEmit }) } as unknown as Server,
      { data: { auth: { user: ownerUser } }, emit: vi.fn() } as unknown as Socket,
      {
        roomPresence: new Map<string, Map<string, Presence>>(),
        roomElements: new Map<string, Map<string, Element>>(),
        roomClocks: new Map(),
        autosave: {} as AutosaveManager,
        db,
      },
      { roomId: 'room-1', userId: memberUser.id, role: 'viewer' },
    );

    expect(db.roomMember.update).toHaveBeenCalledWith({
      where: { roomId_userId: { roomId: 'room-1', userId: memberUser.id } },
      data: { role: 'viewer' },
    });
    expect(roomEmit).toHaveBeenCalledWith(
      WS_EVENTS.ROOM_ACCESS,
      expect.objectContaining({
        roomId: 'room-1',
        role: 'owner',
        members: expect.arrayContaining([
          expect.objectContaining({ userId: memberUser.id, role: 'viewer' }),
        ]),
      }),
    );
  });

  it('rejects role updates from non-owner sessions', async () => {
    const socketEmit = vi.fn();
    const db = {
      room: {
        upsert: vi.fn().mockResolvedValue({
          id: 'room-1',
          ownerId: ownerUser.id,
          members: [
            { roomId: 'room-1', userId: ownerUser.id, role: 'owner', user: ownerUser },
            { roomId: 'room-1', userId: memberUser.id, role: 'editor', user: memberUser },
          ],
        }),
      },
      roomMember: {
        update: vi.fn(),
      },
    } as unknown as PrismaClient;

    await handleRoomRoleUpdate(
      { to: vi.fn().mockReturnValue({ emit: vi.fn() }) } as unknown as Server,
      { data: { auth: { user: memberUser } }, emit: socketEmit } as unknown as Socket,
      {
        roomPresence: new Map<string, Map<string, Presence>>(),
        roomElements: new Map<string, Map<string, Element>>(),
        roomClocks: new Map(),
        autosave: {} as AutosaveManager,
        db,
      },
      { roomId: 'room-1', userId: ownerUser.id, role: 'viewer' },
    );

    expect(db.roomMember.update).not.toHaveBeenCalled();
    expect(socketEmit).toHaveBeenCalledWith(WS_EVENTS.ROOM_ACCESS_ERROR, {
      code: 'room-access/forbidden',
      message: 'Only room owners can change roles.',
    });
  });
});

function makeRoleUpdateDb(): PrismaClient {
  return {
    room: {
      upsert: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'room-1',
          ownerId: ownerUser.id,
          members: [
            { roomId: 'room-1', userId: ownerUser.id, role: 'owner', user: ownerUser },
            { roomId: 'room-1', userId: memberUser.id, role: 'editor', user: memberUser },
          ],
        })
        .mockResolvedValueOnce({
          id: 'room-1',
          ownerId: ownerUser.id,
          members: [
            { roomId: 'room-1', userId: ownerUser.id, role: 'owner', user: ownerUser },
            { roomId: 'room-1', userId: memberUser.id, role: 'viewer', user: memberUser },
          ],
        }),
    },
    roomMember: {
      update: vi.fn().mockResolvedValue(null),
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
