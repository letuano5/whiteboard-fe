import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RoomMembersPanel from '../RoomMembersPanel';
import { useRoomAccessStore } from '../room-access.store';
import { updateRoomMemberRole } from '../../sync/socket-client';

vi.mock('../../sync/socket-client', () => ({
  updateRoomMemberRole: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useRoomAccessStore.getState().resetRoomAccess();
});

describe('RoomMembersPanel', () => {
  it('is hidden for non-owner roles', () => {
    useRoomAccessStore.getState().setRoomAccess({
      roomId: 'room-1',
      role: 'editor',
      members: [],
    });

    render(<RoomMembersPanel />);

    expect(screen.queryByLabelText('Room members')).not.toBeInTheDocument();
  });

  it('lets owners change non-owner members between editor and viewer', () => {
    useRoomAccessStore.getState().setRoomAccess({
      roomId: 'room-1',
      role: 'owner',
      members: [
        {
          userId: 'owner-user',
          email: 'owner@example.com',
          name: 'Owner',
          avatarUrl: null,
          role: 'owner',
        },
        {
          userId: 'member-user',
          email: 'member@example.com',
          name: 'Member',
          avatarUrl: null,
          role: 'editor',
        },
      ],
    });

    render(<RoomMembersPanel />);
    fireEvent.change(screen.getByLabelText('Role for Member'), { target: { value: 'viewer' } });

    expect(updateRoomMemberRole).toHaveBeenCalledWith('member-user', 'viewer');
    expect(screen.getByLabelText('Role for Member')).toBeInTheDocument();
  });
});
