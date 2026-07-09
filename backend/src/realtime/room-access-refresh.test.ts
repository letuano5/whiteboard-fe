import type { PrismaClient } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import { describe, expect, it, vi } from 'vitest';
import { WS_EVENTS, type Presence } from '@vdt/shared';
import type { AppUser } from '../auth/index.js';
import { refreshRoomAccessForRoomSockets } from './room-access-refresh.js';

const owner = makeUser('owner');
const member = makeUser('member');

describe('refreshRoomAccessForRoomSockets', () => {
  it('keeps email members but removes link-only sockets when a room becomes private', async () => {
    const ownerEmit = vi.fn();
    const memberEmit = vi.fn();
    const linkEmit = vi.fn();
    const linkLeave = vi.fn();
    const ownerSocket = makeSocket('socket-owner', owner, ownerEmit);
    const memberSocket = makeSocket('socket-member', member, memberEmit);
    const linkSocket = makeSocket('socket-link', undefined, linkEmit, linkLeave);
    const userLeaveEmit = vi.fn();
    const roomPresence = new Map<string, Map<string, Presence>>([
      [
        'room-1',
        new Map([
          [ownerSocket.id, makePresence('session-owner', owner.id, 'owner')],
          [memberSocket.id, makePresence('session-member', member.id, 'editor')],
          [linkSocket.id, makePresence('session-link', undefined, 'editor')],
        ]),
      ],
    ]);

    await refreshRoomAccessForRoomSockets(
      makeServer([ownerSocket, memberSocket, linkSocket], userLeaveEmit),
      {
        db: makeDb({
          visibility: 'private',
          members: [makeMember(owner, 'owner'), makeMember(member, 'editor')],
        }),
        roomPresence,
        syncRooms: new Map(),
      },
      'room-1',
    );

    expect(ownerEmit).toHaveBeenCalledWith(
      WS_EVENTS.ROOM_ACCESS,
      expect.objectContaining({ effectiveRole: 'owner', visibility: 'private' }),
    );
    expect(memberEmit).toHaveBeenCalledWith(
      WS_EVENTS.ROOM_ACCESS,
      expect.objectContaining({ effectiveRole: 'editor', visibility: 'private' }),
    );
    expect(linkEmit).toHaveBeenCalledWith(WS_EVENTS.ROOM_ACCESS_ERROR, {
      code: 'room-access/forbidden',
      message: 'Room access changed. You no longer have permission to stay in this room.',
    });
    expect(linkLeave).toHaveBeenCalledWith('room-1');
    expect(roomPresence.get('room-1')?.has(linkSocket.id)).toBe(false);
    expect(userLeaveEmit).toHaveBeenCalledWith(WS_EVENTS.USER_LEAVE, {
      sessionId: 'session-link',
    });
  });

  it('falls back to link access when a removed email member is still allowed by link mode', async () => {
    const memberEmit = vi.fn();
    const memberSocket = makeSocket('socket-member', member, memberEmit);
    const memberLeave = vi.fn();
    memberSocket.leave = memberLeave;

    await refreshRoomAccessForRoomSockets(
      makeServer([memberSocket], vi.fn()),
      {
        db: makeDb({
          visibility: 'link_view',
          members: [makeMember(owner, 'owner')],
        }),
        roomPresence: new Map([
          [
            'room-1',
            new Map([[memberSocket.id, makePresence('session-member', member.id, 'editor')]]),
          ],
        ]),
        syncRooms: new Map(),
      },
      'room-1',
    );

    expect(memberEmit).toHaveBeenCalledWith(
      WS_EVENTS.ROOM_ACCESS,
      expect.objectContaining({
        baseRole: 'viewer',
        effectiveRole: 'viewer',
        visibility: 'link_view',
      }),
    );
    expect(memberLeave).not.toHaveBeenCalled();
  });
});

function makeServer(sockets: Socket[], roomEmit: ReturnType<typeof vi.fn>): Server {
  return {
    sockets: { sockets: new Map(sockets.map((socket) => [socket.id, socket])) },
    to: vi.fn().mockReturnValue({ emit: roomEmit }),
  } as unknown as Server;
}

function makeSocket(
  id: string,
  user: AppUser | undefined,
  emit: ReturnType<typeof vi.fn>,
  leave: ReturnType<typeof vi.fn> = vi.fn(),
): Socket {
  return {
    id,
    data: {
      roomId: 'room-1',
      sessionId: id.replace('socket-', 'session-'),
      auth: user ? { user } : undefined,
    },
    rooms: new Set(['room-1']),
    emit,
    leave,
  } as unknown as Socket;
}

function makeDb(room: {
  visibility: 'private' | 'link_view' | 'link_edit';
  members: ReturnType<typeof makeMember>[];
}): PrismaClient {
  return {
    room: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'room-1',
        name: 'Room',
        workspaceId: null,
        ownerId: owner.id,
        visibility: room.visibility,
        shareRevokedAt: null,
        locked: false,
        maxParticipants: null,
        maxEditors: null,
        archivedAt: null,
        lastOpenedAt: null,
        createdBy: owner.id,
        documentClock: 0n,
        tombstoneHistoryStartsAtClock: 0n,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        members: room.members,
        invitations: [],
      }),
    },
    roomInvitation: {},
  } as unknown as PrismaClient;
}

function makeMember(user: AppUser, role: 'owner' | 'editor' | 'viewer') {
  return {
    roomId: 'room-1',
    userId: user.id,
    role,
    user,
  };
}

function makePresence(
  sessionId: string,
  userId: string | undefined,
  effectiveRole: Presence['effectiveRole'],
): Presence {
  return {
    sessionId,
    userId,
    name: sessionId,
    color: '#111111',
    cursor: null,
    selectedIds: [],
    status: 'active',
    baseRole: effectiveRole,
    effectiveRole,
  };
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
