import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { useAuthStore } from '../../auth/auth.store';
import { useRoomAccessStore } from '../../rooms/room-access.store';
import { initSocketClient, stopSocketClient } from '../../sync/socket-client';
import { dashboardPath } from '../routing';

// Mock heavy canvas components to keep routing tests fast
vi.mock('../../canvas/Whiteboard', () => ({
  default: ({ mode }: { mode: 'local' | 'saved' }) => (
    <div data-mode={mode} data-testid="whiteboard" />
  ),
}));
vi.mock('../../documents/DocumentDashboard', () => ({
  DocumentDashboard: () => <div data-testid="document-dashboard" />,
}));
// Prevent socket-client from actually connecting in routing tests
vi.mock('../../sync/socket-client', () => ({
  initSocketClient: vi.fn(),
  stopSocketClient: vi.fn(),
}));

function setLocation(pathname: string, search: string) {
  Object.defineProperty(window, 'location', {
    value: {
      ...window.location,
      pathname,
      search,
      href: `http://localhost:5173${pathname}${search}`,
    },
    writable: true,
  });
}

beforeEach(() => {
  setLocation('/', '');
  vi.mocked(initSocketClient).mockClear();
  vi.mocked(stopSocketClient).mockClear();
  useAuthStore.setState({
    session: null,
    status: 'anonymous',
    errorMessage: null,
    noticeMessage: null,
  });
  useRoomAccessStore.getState().resetRoomAccess();
});

describe('App routing — AC-1', () => {
  // @covers AC-1
  it('shows local board when no ?room= param is present', () => {
    setLocation('/', '');
    render(<App />);
    expect(screen.getByTestId('whiteboard')).toHaveAttribute('data-mode', 'local');
  });
});

describe('App routing — AC-3', () => {
  // @covers AC-3
  it('shows saved canvas when ?room=<id> param is present', () => {
    setLocation('/', '?room=test-room-id');
    render(<App />);
    expect(screen.getByTestId('whiteboard')).toHaveAttribute('data-mode', 'saved');
  });

  it('reconnects the saved board socket when the access token changes', async () => {
    setLocation('/', '?room=test-room-id');
    useAuthStore.setState({
      session: {
        accessToken: 'token-a',
        expiresAt: 123,
        user: {
          id: 'user-123',
          email: 'player@example.com',
          name: 'Player',
          avatarUrl: null,
        },
      },
      status: 'authenticated',
    });

    render(<App />);

    act(() => {
      useAuthStore.setState({
        session: {
          accessToken: 'token-b',
          expiresAt: 456,
          user: {
            id: 'user-123',
            email: 'player@example.com',
            name: 'Player',
            avatarUrl: null,
          },
        },
        status: 'authenticated',
      });
    });

    await waitFor(() => {
      expect(stopSocketClient).toHaveBeenCalledTimes(1);
      expect(initSocketClient).toHaveBeenCalledWith('test-room-id');
    });
  });

  it('shows an access error with a dashboard button when a private room rejects the user', async () => {
    setLocation('/', '?room=private-room-id');
    useRoomAccessStore.getState().setRoomAccessError({
      code: 'room-access/forbidden',
      message: 'Room access denied.',
    });

    render(<App />);

    expect(screen.queryByTestId('whiteboard')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Room access denied.');
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    const pushStateSpy = vi.spyOn(window.history, 'pushState');

    await userEvent.click(screen.getByRole('button', { name: /open dashboard/i }));

    expect(pushStateSpy).toHaveBeenCalledWith({}, '', dashboardPath());
    pushStateSpy.mockRestore();
  });
});

describe('App routing — dashboard', () => {
  it('shows the document dashboard on /dashboard without rendering a whiteboard', () => {
    // @covers AC-1
    setLocation('/dashboard', '');

    render(<App />);

    expect(screen.getByTestId('document-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('whiteboard')).not.toBeInTheDocument();
  });

  it('switches views on a location change without remounting the app', () => {
    setLocation('/', '');
    render(<App />);
    expect(screen.getByTestId('whiteboard')).toBeInTheDocument();

    // Simulates what navigate()/browser back-forward trigger: a location
    // change followed by a popstate event, with no render() call in between.
    setLocation('/dashboard', '');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByTestId('document-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('whiteboard')).not.toBeInTheDocument();
  });
});
