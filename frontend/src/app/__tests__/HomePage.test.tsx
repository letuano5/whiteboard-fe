import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HomePage from '../HomePage';

vi.mock('../../auth/AuthPanel', () => ({
  AuthPanel: () => <div data-testid="auth-panel" />,
}));

const mockPushState = vi.fn();
const mockReload = vi.fn();

beforeEach(() => {
  mockPushState.mockClear();
  mockReload.mockClear();
  Object.defineProperty(window, 'history', {
    value: { ...window.history, pushState: mockPushState },
    writable: true,
  });
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: mockReload },
    writable: true,
  });
  // Stub crypto.randomUUID
  vi.stubGlobal('crypto', {
    randomUUID: () => 'test-uuid-1234',
  });
});

describe('HomePage — AC-2', () => {
  // @covers AC-2
  it('clicking "Create new room" navigates to ?room=<uuid>', () => {
    render(<HomePage />);
    const btn = screen.getByRole('button', { name: /create.*room/i });
    fireEvent.click(btn);
    expect(mockPushState).toHaveBeenCalledWith({}, '', '/?room=test-uuid-1234');
    expect(mockReload).toHaveBeenCalled();
  });
});
