import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RoomHistoryButton } from '../RoomHistoryButton';
import { fetchRoomSnapshots, restoreRoomSnapshot } from '../room-history-api';

vi.mock('../room-history-api', () => ({
  fetchRoomSnapshots: vi.fn(),
  restoreRoomSnapshot: vi.fn(),
}));

const snapshots = [
  {
    id: 'snap-1',
    documentClock: '7',
    roomEpoch: 2,
    createdBy: 'owner-1',
    createdAt: '2026-07-03T03:00:00.000Z',
    reason: 'interval' as const,
  },
  {
    id: 'snap-2',
    documentClock: '9',
    roomEpoch: 3,
    createdBy: 'owner-1',
    createdAt: '2026-07-03T03:05:00.000Z',
    reason: 'restore_safety' as const,
  },
];

beforeEach(() => {
  vi.mocked(fetchRoomSnapshots).mockReset();
  vi.mocked(fetchRoomSnapshots).mockResolvedValue(snapshots);
  vi.mocked(restoreRoomSnapshot).mockReset();
  vi.mocked(restoreRoomSnapshot).mockResolvedValue({
    documentClock: '10',
    roomEpoch: 4,
    restoredElementCount: 2,
  });
});

describe('RoomHistoryButton', () => {
  it('lists snapshot metadata from the saved room history API', async () => {
    // @covers AC-1
    render(<RoomHistoryButton roomId="room-1" canRestore />);

    fireEvent.click(screen.getByRole('button', { name: /open version history/i }));

    expect(await screen.findByRole('heading', { name: /snapshot history/i })).toBeInTheDocument();
    expect(fetchRoomSnapshots).toHaveBeenCalledWith('room-1');
    expect(screen.getByText(/clock 7/i)).toBeInTheDocument();
    expect(screen.getByText(/epoch 2/i)).toBeInTheDocument();
    expect(screen.getAllByText(/owner-1/i)).toHaveLength(2);
    expect(screen.getByText(/restore safety/i)).toBeInTheDocument();
  });

  it('requires owner confirmation before posting snapshot restore', async () => {
    // @covers AC-2
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<RoomHistoryButton roomId="room-1" canRestore />);

    fireEvent.click(screen.getByRole('button', { name: /open version history/i }));
    const restoreButtons = await screen.findAllByRole('button', { name: /restore snapshot from/i });
    fireEvent.click(restoreButtons[0]!);

    expect(confirmSpy).toHaveBeenCalledWith(
      'Restore this snapshot? Current document state will be replaced.',
    );
    await waitFor(() => {
      expect(restoreRoomSnapshot).toHaveBeenCalledWith('room-1', 'snap-1');
    });
    confirmSpy.mockRestore();
  });

  it('hides restore controls for non-owner users', async () => {
    // @covers AC-7
    render(<RoomHistoryButton roomId="room-1" canRestore={false} />);

    fireEvent.click(screen.getByRole('button', { name: /open version history/i }));

    await screen.findByRole('heading', { name: /snapshot history/i });
    expect(
      screen.queryByRole('button', { name: /restore snapshot from/i }),
    ).not.toBeInTheDocument();
  });

  it('closes the version history panel when clicking outside', async () => {
    render(<RoomHistoryButton roomId="room-1" canRestore />);

    fireEvent.click(screen.getByRole('button', { name: /open version history/i }));
    expect(await screen.findByRole('heading', { name: /snapshot history/i })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('heading', { name: /snapshot history/i })).not.toBeInTheDocument();
  });
});
