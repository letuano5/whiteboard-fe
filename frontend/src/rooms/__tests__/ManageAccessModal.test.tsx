import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManageAccessModal } from '../ManageAccessModal';
import { useRoomAccessStore } from '../room-access.store';
import {
  inviteRoomUser,
  removeRoomMember,
  setRoomShareMode,
  updateRoomCapacitySettings,
  updateRoomMemberRole,
} from '../room-access-api';

vi.mock('../room-access-api', () => ({
  inviteRoomUser: vi.fn(),
  removeRoomMember: vi.fn(),
  setRoomShareMode: vi.fn(),
  updateRoomCapacitySettings: vi.fn(),
  updateRoomMemberRole: vi.fn(),
}));

const ownerAccess = {
  roomId: 'room-1',
  role: 'owner' as const,
  baseRole: 'owner' as const,
  effectiveRole: 'owner' as const,
  visibility: 'private' as const,
  maxParticipants: null,
  maxEditors: null,
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
  vi.mocked(updateRoomCapacitySettings).mockResolvedValue(ownerAccess);
});

describe('ManageAccessModal', () => {
  it('renders a Share modal with member controls and three link access modes', () => {
    // @covers AC-1
    render(<ManageAccessModal roomId="room-1" onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: /share/i })).toBeInTheDocument();
    expect(screen.getByText('member@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Private' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Can view' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Can edit' })).toBeInTheDocument();
    expect(screen.getByText('Set participant limits')).toBeInTheDocument();
    expect(screen.getByLabelText('Max participants')).toBeInTheDocument();
    expect(screen.getByLabelText('Max editors')).toBeInTheDocument();
  });

  it('adds email, changes role, removes member, and updates link access', async () => {
    // @covers AC-1
    render(<ManageAccessModal roomId="room-1" onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Add email'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Invite role'), { target: { value: 'editor' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Invite' }).closest('form')!);
    fireEvent.change(screen.getByLabelText('Role for member@example.com'), {
      target: { value: 'viewer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove member@example.com' }));
    fireEvent.click(screen.getByRole('button', { name: 'Can edit' }));

    await waitFor(() => {
      expect(inviteRoomUser).toHaveBeenCalledWith('room-1', 'new@example.com', 'editor');
      expect(updateRoomMemberRole).toHaveBeenCalledWith('room-1', 'member-1', 'viewer');
      expect(removeRoomMember).toHaveBeenCalledWith('room-1', 'member-1');
      expect(setRoomShareMode).toHaveBeenCalledWith('room-1', 'link_edit');
    });
  });

  it('updates room capacity limits from the Share modal', async () => {
    // @covers AC-2
    render(<ManageAccessModal roomId="room-1" onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Max participants'), { target: { value: '20' } });
    fireEvent.blur(screen.getByLabelText('Max participants'));
    fireEvent.change(screen.getByLabelText('Max editors'), { target: { value: '5' } });
    fireEvent.blur(screen.getByLabelText('Max editors'));

    await waitFor(() => {
      expect(updateRoomCapacitySettings).toHaveBeenCalledWith('room-1', {
        maxParticipants: 20,
      });
      expect(updateRoomCapacitySettings).toHaveBeenCalledWith('room-1', { maxEditors: 5 });
    });
  });

  it('closes when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<ManageAccessModal roomId="room-1" onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });
});
