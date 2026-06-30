import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AppUser } from '../auth/index.js';
import {
  inviteRoomUser,
  revokeRoomShareLink,
  updateRoomMemberRole,
} from './room-access-management.js';
import { resolveRoomAccess } from './room-roles.js';

const owner = makeUser('owner', 'owner@example.com');
const editor = makeUser('editor', 'editor@example.com');
const outsider = makeUser('outsider', 'outsider@example.com');

describe('resolveRoomAccess', () => {
  it('rejects private rooms for users without membership', async () => {
    // @covers AC-6
    const db = makeDb([makeRoom({ visibility: 'private' })]);

    await expect(resolveRoomAccess(db, 'room-1', outsider)).rejects.toThrow('Room access denied.');
  });

  it('allows link_view visitors as viewers', async () => {
    // @covers AC-7
    const db = makeDb([makeRoom({ visibility: 'link_view' })]);

    await expect(resolveRoomAccess(db, 'room-1', undefined)).resolves.toMatchObject({
      baseRole: 'viewer',
      effectiveRole: 'viewer',
      role: 'viewer',
      visibility: 'link_view',
    });
  });

  it('allows link_edit visitors as editors unless the room is locked', async () => {
    // @covers AC-8
    const openDb = makeDb([makeRoom({ visibility: 'link_edit', locked: false })]);
    const lockedDb = makeDb([makeRoom({ visibility: 'link_edit', locked: true })]);

    await expect(resolveRoomAccess(openDb, 'room-1', undefined)).resolves.toMatchObject({
      baseRole: 'editor',
      effectiveRole: 'editor',
    });
    await expect(resolveRoomAccess(lockedDb, 'room-1', undefined)).resolves.toMatchObject({
      baseRole: 'editor',
      effectiveRole: 'viewer',
    });
  });

  it('does not claim legacy pending invitations while resolving private access', async () => {
    // @covers AC-4
    const db = makeDb([
      makeRoom({
        visibility: 'private',
        invitations: [
          {
            id: 'invite-1',
            roomId: 'room-1',
            email: 'outsider@example.com',
            role: 'editor',
            invitedBy: owner.id,
            claimedBy: null,
            claimedAt: null,
            revokedAt: null,
            createdAt: new Date(0),
            updatedAt: new Date(0),
          },
        ],
      }),
    ]);

    await expect(resolveRoomAccess(db, 'room-1', outsider)).rejects.toThrow('Room access denied.');
    expect(db.roomMember.upsert).not.toHaveBeenCalled();
    expect(db.roomInvitation.update).not.toHaveBeenCalled();
  });
});

describe('room access management', () => {
  it('adds an existing invited user as a room member with the requested role', async () => {
    // @covers AC-1
    // @covers AC-3
    const db = makeDb([
      makeRoom({ members: [makeMember(owner, 'owner')] }),
      makeRoom({ members: [makeMember(owner, 'owner'), makeMember(editor, 'viewer')] }),
    ]);
    db.appUser.findFirst = vi.fn().mockResolvedValue({ id: editor.id });

    await inviteRoomUser(db, 'room-1', owner, 'editor@example.com', 'viewer');

    expect(db.roomMember.upsert).toHaveBeenCalledWith({
      where: { roomId_userId: { roomId: 'room-1', userId: editor.id } },
      create: { roomId: 'room-1', userId: editor.id, role: 'viewer' },
      update: { role: 'viewer' },
    });
  });

  it('rejects adding an email that is not an existing user', async () => {
    // @covers AC-1
    const db = makeDb([makeRoom({ members: [makeMember(owner, 'owner')] })]);
    db.appUser.findFirst = vi.fn().mockResolvedValue(null);

    await expect(
      inviteRoomUser(db, 'room-1', owner, 'missing@example.com', 'viewer'),
    ).rejects.toThrow('No user with that email exists in this workspace.');

    expect(db.roomMember.upsert).not.toHaveBeenCalled();
    expect(db.roomInvitation.upsert).not.toHaveBeenCalled();
  });

  it('rejects access management from non-owners', async () => {
    // @covers AC-2
    const db = makeDb([
      makeRoom({ members: [makeMember(owner, 'owner'), makeMember(editor, 'editor')] }),
    ]);

    await expect(updateRoomMemberRole(db, 'room-1', editor, outsider.id, 'viewer')).rejects.toThrow(
      'Only room owners can change roles.',
    );
  });

  it('revokes link access by returning the room to private mode', async () => {
    // @covers AC-9
    const db = makeDb([
      makeRoom({ visibility: 'link_view', members: [makeMember(owner, 'owner')] }),
      makeRoom({ visibility: 'private', members: [makeMember(owner, 'owner')] }),
    ]);

    await revokeRoomShareLink(db, 'room-1', owner);

    expect(db.room.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: { visibility: 'private', shareRevokedAt: expect.any(Date) },
    });
  });
});

type RoomRoleRecord = 'owner' | 'editor' | 'viewer';

function makeDb(rooms: ReturnType<typeof makeRoom>[]): PrismaClient {
  return {
    room: {
      findUnique: vi.fn().mockImplementation(async () => rooms.shift() ?? null),
      update: vi.fn().mockResolvedValue(null),
    },
    roomMember: {
      upsert: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(null),
    },
    roomInvitation: {
      upsert: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue({ id: 'invite-1' }),
    },
    appUser: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaClient;
}

function makeRoom(
  overrides: Partial<ReturnType<typeof baseRoom>> & {
    members?: ReturnType<typeof makeMember>[];
    invitations?: Array<{
      id: string;
      roomId: string;
      email: string;
      role: string;
      invitedBy: string;
      claimedBy: string | null;
      claimedAt: Date | null;
      revokedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
  } = {},
) {
  return {
    ...baseRoom(),
    ...overrides,
    members: overrides.members ?? [makeMember(owner, 'owner')],
    invitations: overrides.invitations ?? [],
  };
}

function baseRoom() {
  return {
    id: 'room-1',
    name: 'Room',
    workspaceId: null,
    ownerId: owner.id,
    visibility: 'private',
    shareRevokedAt: null,
    locked: false,
    archivedAt: null,
    lastOpenedAt: null,
    createdBy: owner.id,
    documentClock: 0n,
    tombstoneHistoryStartsAtClock: 0n,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function makeMember(user: AppUser, role: RoomRoleRecord) {
  return {
    roomId: 'room-1',
    userId: user.id,
    role,
    lastOpenedAt: null,
    user,
  };
}

function makeUser(id: string, email: string): AppUser {
  return {
    id,
    provider: 'test',
    providerSubject: id,
    email,
    name: id,
    avatarUrl: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}
