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
  it('copies the current URL to clipboard on click', async () => {
    render(<ShareLinkButton />);
    const btn = screen.getByRole('button', { name: /copy link/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(writeTextMock).toHaveBeenCalledWith('http://localhost:5173/?room=test-room');
  });
});

describe('ShareLinkButton — AC-8', () => {
  // @covers AC-8
  it('shows "Copied!" feedback after click, reverts after 2 seconds', async () => {
    render(<ShareLinkButton />);
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
  });
});
