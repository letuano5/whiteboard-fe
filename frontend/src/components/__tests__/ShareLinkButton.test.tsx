import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ShareLinkButton from '../ShareLinkButton';
import { useRoomAccessStore } from '../../rooms/room-access.store';

const writeTextMock = vi.fn(() => Promise.resolve());

beforeEach(() => {
  writeTextMock.mockClear();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, href: 'http://localhost:5173/?room=test-room' },
    writable: true,
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: writeTextMock },
    writable: true,
  });
  useRoomAccessStore.getState().resetRoomAccess();
  useRoomAccessStore.getState().setRoomAccess({
    roomId: 'test-room',
    role: 'owner',
    baseRole: 'owner',
    effectiveRole: 'owner',
    visibility: 'link_view',
    shareRevokedAt: null,
    members: [],
    invitations: [],
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ShareLinkButton — AC-7', () => {
  // @covers AC-7
  it('opens the Share dialog from a single green Share button', () => {
    render(<ShareLinkButton />);

    expect(screen.queryByLabelText('Share link mode')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /share/i }));

    expect(screen.getByRole('dialog', { name: /share/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Private' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Public viewer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Public editor' })).toBeInTheDocument();
  });
});

describe('ShareLinkButton — AC-8', () => {
  // @covers AC-8
  it('shows "Copied!" feedback after click, reverts after 2 seconds', async () => {
    render(<ShareLinkButton />);
    fireEvent.click(screen.getByRole('button', { name: /share/i }));
    const btn = screen.getByRole('button', { name: /copy link/i });

    expect(btn.textContent).not.toMatch(/copied/i);

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(btn.textContent).toMatch(/copied/i);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(btn.textContent).not.toMatch(/copied/i);
    expect(writeTextMock).toHaveBeenCalledWith('http://localhost:5173/?room=test-room');
  });
});
