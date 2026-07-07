import type { PrismaClient } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import { describe, expect, it, vi } from 'vitest';
import { WS_EVENTS, type Element, type Presence } from '@vdt/shared';
import type { AppUser } from '../../auth/index.js';
import { handleRoomRoleUpdate } from './room-role-update.js';

const ownerUser = makeUser('owner-user');
const memberUser = makeUser('member-user');

describe('handleRoomRoleUpdate', () => {
  it('persists member role changes and emits per-socket access payloads', async () => {
    const ownerEmit = vi.fn();
    const memberEmit = vi.fn();
    const db = makeRoleUpdateDb();
    const ownerSocket = makeSocket('socket-owner', ownerUser, ownerEmit);
    const memberSocket = makeSocket('socket-member', memberUser, memberEmit);
    const sockets = new Map<string, Socket>([
      [ownerSocket.id, ownerSocket],
      [memberSocket.id, memberSocket],
    ]);

    await handleRoomRoleUpdate(
      { sockets: { sockets }, to: vi.fn() } as unknown as Server,
      ownerSocket,
      {
        roomPresence: new Map<string, Map<string, Presence>>([
          [
            'room-1',
            new Map([
              [
                ownerSocket.id,
                {
                  sessionId: 'session-owner',
                  userId: ownerUser.id,
                  name: 'Owner',
                  color: '#111111',
                  cursor: null,
                  selectedIds: [],
                  status: 'active',
                  baseRole: 'owner',
                  effectiveRole: 'owner',
                },
              ],
              [
                memberSocket.id,
                {
                  sessionId: 'session-member',
                  userId: memberUser.id,
                  name: 'Member',
                  color: '#222222',
                  cursor: null,
                  selectedIds: [],
                  status: 'active',
                  baseRole: 'editor',
                  effectiveRole: 'editor',
                },
              ],
            ]),
          ],
        ]),
        roomElements: new Map<string, Map<string, Element>>(),
        roomClocks: new Map(),
        syncRooms: new Map(),
        db,
      },
      { roomId: 'room-1', userId: memberUser.id, role: 'viewer' },
    );

    expect(db.roomMember.update).toHaveBeenCalledWith({
      where: { roomId_userId: { roomId: 'room-1', userId: memberUser.id } },
      data: { role: 'viewer' },
    });
    expect(ownerEmit).toHaveBeenCalledWith(
      WS_EVENTS.ROOM_ACCESS,
      expect.objectContaining({
        roomId: 'room-1',
        effectiveRole: 'owner',
        members: expect.arrayContaining([
          expect.objectContaining({ userId: memberUser.id, role: 'viewer' }),
        ]),
      }),
    );
    expect(memberEmit).toHaveBeenCalledWith(
      WS_EVENTS.ROOM_ACCESS,
      expect.objectContaining({
        roomId: 'room-1',
        effectiveRole: 'viewer',
        members: expect.arrayContaining([
          expect.objectContaining({ userId: memberUser.id, role: 'viewer' }),
        ]),
      }),
    );
    expect(memberEmit).not.toHaveBeenCalledWith(
      WS_EVENTS.ROOM_ACCESS,
      expect.objectContaining({ effectiveRole: 'owner' }),
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
        syncRooms: new Map(),
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
  const beforeUpdate = {
    id: 'room-1',
    ownerId: ownerUser.id,
    members: [
      { roomId: 'room-1', userId: ownerUser.id, role: 'owner', user: ownerUser },
      { roomId: 'room-1', userId: memberUser.id, role: 'editor', user: memberUser },
    ],
  };
  const afterUpdate = {
    id: 'room-1',
    ownerId: ownerUser.id,
    members: [
      { roomId: 'room-1', userId: ownerUser.id, role: 'owner', user: ownerUser },
      { roomId: 'room-1', userId: memberUser.id, role: 'viewer', user: memberUser },
    ],
  };

  return {
    room: {
      upsert: vi
        .fn()
        .mockResolvedValueOnce(beforeUpdate)
        .mockResolvedValue(afterUpdate),
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

function makeSocket(id: string, user: AppUser, emit: ReturnType<typeof vi.fn>): Socket {
  return {
    id,
    data: {
      roomId: 'room-1',
      sessionId: id === 'socket-owner' ? 'session-owner' : 'session-member',
      auth: { user },
    },
    rooms: new Set(['room-1']),
    emit,
  } as unknown as Socket;
}
