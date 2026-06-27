import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ShareLinkButton from '../ShareLinkButton';

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
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ShareLinkButton — AC-7', () => {
  // @covers AC-7
  it('copies the current URL to clipboard on click', async () => {
    render(<ShareLinkButton />);
    const btn = screen.getByRole('button');
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
    const btn = screen.getByRole('button');

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
