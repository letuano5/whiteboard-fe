import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticatedFetch } from '../../auth/authenticated-fetch';
import {
  inviteRoomUser,
  removeRoomMember,
  revokeRoomInvitation,
  revokeRoomShareLink,
  setRoomShareMode,
  updateRoomCapacitySettings,
  updateRoomMemberRole,
} from '../room-access-api';

vi.mock('../../auth/authenticated-fetch', () => ({
  authenticatedFetch: vi.fn(),
}));

const accessPayload = {
  roomId: 'room-1',
  role: 'owner',
  baseRole: 'owner',
  effectiveRole: 'owner',
  visibility: 'link_view',
  maxParticipants: null,
  maxEditors: null,
  shareRevokedAt: null,
  members: [],
  invitations: [],
};

beforeEach(() => {
  vi.mocked(authenticatedFetch).mockReset();
  vi.mocked(authenticatedFetch).mockImplementation(
    async () => new Response(JSON.stringify(accessPayload), { status: 200 }),
  );
});

describe('room access API client', () => {
  it('updates and revokes share link modes through owner endpoints', async () => {
    // @covers AC-9
    await setRoomShareMode('room-1', 'link_edit');
    await revokeRoomShareLink('room-1');

    expect(authenticatedFetch).toHaveBeenNthCalledWith(1, '/api/rooms/room-1/share', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'link_edit' }),
    });
    expect(authenticatedFetch).toHaveBeenNthCalledWith(2, '/api/rooms/room-1/share', {
      method: 'DELETE',
    });
  });

  it('sends invitation, member role, member remove, and invitation revoke requests', async () => {
    // @covers AC-1
    await inviteRoomUser('room-1', 'new@example.com', 'editor');
    await updateRoomMemberRole('room-1', 'member-1', 'viewer');
    await removeRoomMember('room-1', 'member-1');
    await revokeRoomInvitation('room-1', 'invite-1');

    expect(authenticatedFetch).toHaveBeenNthCalledWith(1, '/api/rooms/room-1/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com', role: 'editor' }),
    });
    expect(authenticatedFetch).toHaveBeenNthCalledWith(2, '/api/rooms/room-1/members/member-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'viewer' }),
    });
    expect(authenticatedFetch).toHaveBeenNthCalledWith(3, '/api/rooms/room-1/members/member-1', {
      method: 'DELETE',
    });
    expect(authenticatedFetch).toHaveBeenNthCalledWith(
      4,
      '/api/rooms/room-1/invitations/invite-1',
      { method: 'DELETE' },
    );
  });

  it('updates room capacity through the owner endpoint', async () => {
    // @covers AC-2
    await updateRoomCapacitySettings('room-1', { maxParticipants: 20, maxEditors: 5 });

    expect(authenticatedFetch).toHaveBeenCalledWith('/api/rooms/room-1/capacity', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxParticipants: 20, maxEditors: 5 }),
    });
  });
});
