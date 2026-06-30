import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManageAccessModal } from '../ManageAccessModal';
import { useRoomAccessStore } from '../room-access.store';
import {
  inviteRoomUser,
  removeRoomMember,
  setRoomShareMode,
  updateRoomMemberRole,
} from '../room-access-api';

vi.mock('../room-access-api', () => ({
  inviteRoomUser: vi.fn(),
  removeRoomMember: vi.fn(),
  setRoomShareMode: vi.fn(),
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
  invitations: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  useRoomAccessStore.getState().resetRoomAccess();
  useRoomAccessStore.getState().setRoomAccess(ownerAccess);
  vi.mocked(inviteRoomUser).mockResolvedValue(ownerAccess);
  vi.mocked(updateRoomMemberRole).mockResolvedValue(ownerAccess);
  vi.mocked(removeRoomMember).mockResolvedValue(ownerAccess);
  vi.mocked(setRoomShareMode).mockResolvedValue(ownerAccess);
});

describe('ManageAccessModal', () => {
  it('renders a Share modal with member controls and three link access modes', () => {
    // @covers AC-1
    render(<ManageAccessModal roomId="room-1" onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: /share/i })).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Private' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Public viewer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Public editor' })).toBeInTheDocument();
  });

  it('adds email, changes role, removes member, and updates link access', async () => {
    // @covers AC-1
    render(<ManageAccessModal roomId="room-1" onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Add email'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Invite role'), { target: { value: 'editor' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Add' }).closest('form')!);
    fireEvent.change(screen.getByLabelText('Role for Member'), { target: { value: 'viewer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Public editor' }));

    await waitFor(() => {
      expect(inviteRoomUser).toHaveBeenCalledWith('room-1', 'new@example.com', 'editor');
      expect(updateRoomMemberRole).toHaveBeenCalledWith('room-1', 'member-1', 'viewer');
      expect(removeRoomMember).toHaveBeenCalledWith('room-1', 'member-1');
      expect(setRoomShareMode).toHaveBeenCalledWith('room-1', 'link_edit');
    });
  });
});
