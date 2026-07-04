import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AppUser } from '../auth/index.js';
import {
  inviteRoomUser,
  revokeRoomShareLink,
  updateRoomCapacitySettings,
  updateRoomMemberRole,
} from './room-access-management.js';
import { resolveRoomAccess } from './room-roles.js';
import type { Presence } from '@vdt/shared';

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

  it('allows link_edit visitors as editors', async () => {
    // @covers AC-8
    const db = makeDb([makeRoom({ visibility: 'link_edit', locked: true })]);

    await expect(resolveRoomAccess(db, 'room-1', undefined)).resolves.toMatchObject({
      baseRole: 'editor',
      effectiveRole: 'editor',
    });
  });

  it('rejects new participants when maxParticipants is already reached', async () => {
    // @covers AC-3
    const db = makeDb([makeRoom({ visibility: 'link_view', maxParticipants: 1 })]);

    await expect(
      resolveRoomAccess(db, 'room-1', undefined, {
        activePresences: [makePresence('existing-session', 'viewer')],
        currentSessionId: 'new-session',
      }),
    ).rejects.toThrow('Room participant limit reached.');
  });

  it('downgrades eligible editors to viewer when maxEditors is already reached', async () => {
    // @covers AC-4
    // @covers AC-6
    const db = makeDb([makeRoom({ visibility: 'link_edit', maxEditors: 1 })]);

    await expect(
      resolveRoomAccess(db, 'room-1', undefined, {
        activePresences: [makePresence('existing-editor', 'editor')],
        currentSessionId: 'new-session',
      }),
    ).resolves.toMatchObject({
      baseRole: 'editor',
      effectiveRole: 'viewer',
      maxEditors: 1,
    });
  });

  it('returns room capacity metadata in the access payload', async () => {
    // @covers AC-5
    const db = makeDb([
      makeRoom({
        maxParticipants: 12,
        maxEditors: 4,
        members: [makeMember(owner, 'owner')],
      }),
    ]);

    await expect(resolveRoomAccess(db, 'room-1', owner)).resolves.toMatchObject({
      maxParticipants: 12,
      maxEditors: 4,
    });
  });

  it('rejects access to a room id that has never been created', async () => {
    const db = makeDb([]);

    await expect(resolveRoomAccess(db, 'unknown-room', outsider)).rejects.toThrow(
      'Room access denied.',
    );
    await expect(resolveRoomAccess(db, 'unknown-room', undefined)).rejects.toThrow(
      'Room access denied.',
    );
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

  it('allows owners to update room capacity limits', async () => {
    // @covers AC-2
    // @covers AC-3
    // @covers AC-4
    const db = makeDb([
      makeRoom({ members: [makeMember(owner, 'owner')] }),
      makeRoom({
        maxParticipants: 20,
        maxEditors: 5,
        members: [makeMember(owner, 'owner')],
      }),
    ]);

    await updateRoomCapacitySettings(db, 'room-1', owner, {
      maxParticipants: 20,
      maxEditors: 5,
    });

    expect(db.room.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: { maxParticipants: 20, maxEditors: 5 },
    });
  });

  it('rejects capacity limits above the configured maximums', async () => {
    // @covers AC-2
    const participantsDb = makeDb([makeRoom({ members: [makeMember(owner, 'owner')] })]);

    await expect(
      updateRoomCapacitySettings(participantsDb, 'room-1', owner, { maxParticipants: 51 }),
    ).rejects.toThrow('Participant limit cannot exceed 50.');
    expect(participantsDb.room.update).not.toHaveBeenCalled();

    const editorsDb = makeDb([makeRoom({ members: [makeMember(owner, 'owner')] })]);

    await expect(
      updateRoomCapacitySettings(editorsDb, 'room-1', owner, { maxEditors: 11 }),
    ).rejects.toThrow('Editor limit cannot exceed 10.');
    expect(editorsDb.room.update).not.toHaveBeenCalled();
  });

  it('rejects editor capacity above participant capacity', async () => {
    // @covers AC-2
    const db = makeDb([makeRoom({ maxParticipants: 3, members: [makeMember(owner, 'owner')] })]);

    await expect(
      updateRoomCapacitySettings(db, 'room-1', owner, { maxEditors: 4 }),
    ).rejects.toThrow('Editor limit cannot exceed participant limit.');

    expect(db.room.update).not.toHaveBeenCalled();
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
    maxParticipants: null as number | null,
    maxEditors: null as number | null,
    archivedAt: null,
    lastOpenedAt: null,
    createdBy: owner.id,
    documentClock: 0n,
    tombstoneHistoryStartsAtClock: 0n,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function makePresence(sessionId: string, effectiveRole: Presence['effectiveRole']): Presence {
  return {
    sessionId,
    name: sessionId,
    color: '#000',
    cursor: null,
    selectedIds: [],
    status: 'active',
    baseRole: effectiveRole,
    effectiveRole,
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
