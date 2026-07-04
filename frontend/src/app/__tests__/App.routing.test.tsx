import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import { useAuthStore } from '../../auth/auth.store';
import { useRoomAccessStore } from '../../rooms/room-access.store';

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

  it('shows an access error instead of a saved canvas when a private room rejects the user', () => {
    setLocation('/', '?room=private-room-id');
    useRoomAccessStore.getState().setRoomAccessError({
      code: 'room-access/forbidden',
      message: 'Room access denied.',
    });

    render(<App />);

    expect(screen.queryByTestId('whiteboard')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Room access denied.');
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
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
});
