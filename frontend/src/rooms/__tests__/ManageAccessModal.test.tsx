import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManageAccessModal } from '../ManageAccessModal';
import { useRoomAccessStore } from '../room-access.store';
import {
  inviteRoomUser,
  removeRoomMember,
  revokeRoomInvitation,
  updateRoomMemberRole,
} from '../room-access-api';

vi.mock('../room-access-api', () => ({
  inviteRoomUser: vi.fn(),
  removeRoomMember: vi.fn(),
  revokeRoomInvitation: vi.fn(),
  updateRoomMemberRole: vi.fn(),
}));

const ownerAccess = {
  roomId: 'room-1',
  role: 'owner' as const,
  baseRole: 'owner' as const,
  effectiveRole: 'owner' as const,
  visibility: 'private' as const,
  shareRevokedAt: null,
  members: [
    {
      userId: 'owner-1',
      email: 'owner@example.com',
      name: 'Owner',
      avatarUrl: null,
      role: 'owner' as const,
    },
    {
      userId: 'member-1',
      email: 'member@example.com',
      name: 'Member',
      avatarUrl: null,
      role: 'editor' as const,
    },
  ],
  invitations: [
    {
      id: 'invite-1',
      email: 'pending@example.com',
      role: 'viewer' as const,
      status: 'pending' as const,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  useRoomAccessStore.getState().resetRoomAccess();
  useRoomAccessStore.getState().setRoomAccess(ownerAccess);
  vi.mocked(inviteRoomUser).mockResolvedValue(ownerAccess);
  vi.mocked(updateRoomMemberRole).mockResolvedValue(ownerAccess);
  vi.mocked(removeRoomMember).mockResolvedValue(ownerAccess);
  vi.mocked(revokeRoomInvitation).mockResolvedValue(ownerAccess);
});

describe('ManageAccessModal', () => {
  it('renders a modal over a dark backdrop with member and pending invite controls', () => {
    // @covers AC-1
    render(<ManageAccessModal roomId="room-1" onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: /manage access/i })).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.getByText('pending@example.com')).toBeInTheDocument();
  });

  it('invites email, changes role, removes member, and revokes pending invite', async () => {
    // @covers AC-1
    render(<ManageAccessModal roomId="room-1" onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Invite email'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Invite role'), { target: { value: 'editor' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Invite' }).closest('form')!);
    fireEvent.change(screen.getByLabelText('Role for Member'), { target: { value: 'viewer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    await waitFor(() => {
      expect(inviteRoomUser).toHaveBeenCalledWith('room-1', 'new@example.com', 'editor');
      expect(updateRoomMemberRole).toHaveBeenCalledWith('room-1', 'member-1', 'viewer');
      expect(removeRoomMember).toHaveBeenCalledWith('room-1', 'member-1');
      expect(revokeRoomInvitation).toHaveBeenCalledWith('room-1', 'invite-1');
    });
  });
});
