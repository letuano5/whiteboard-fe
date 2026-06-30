import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuthStore } from '../../auth/auth.store';
import type { AuthSession } from '../../auth/types';
import { DocumentDashboard } from '../DocumentDashboard';
import { createDocument, listDocuments, openDocument } from '../document-api';

vi.mock('../../auth/AuthPanel', () => ({
  AuthPanel: () => <div data-testid="auth-panel" />,
}));

vi.mock('../document-api', () => ({
  listDocuments: vi.fn(),
  createDocument: vi.fn(),
  openDocument: vi.fn(),
  renameDocument: vi.fn(),
  archiveDocument: vi.fn(),
  deleteDocument: vi.fn(),
}));

const session: AuthSession = {
  accessToken: 'access-token',
  expiresAt: 123,
  user: {
    id: 'user-123',
    email: 'player@example.com',
    name: 'Player',
    avatarUrl: null,
  },
};

const dashboardResponse = {
  owned: [
    {
      id: 'owned-room',
      name: 'Owned Plan',
      ownerId: 'user-123',
      ownerName: 'Player',
      role: 'owner',
      visibility: 'private',
      locked: false,
      archivedAt: null,
      updatedAt: '2026-06-30T10:00:00.000Z',
      lastOpenedAt: '2026-06-30T11:00:00.000Z',
    },
  ],
  sharedWithMe: [
    {
      id: 'shared-room',
      name: 'Shared Plan',
      ownerId: 'owner-456',
      ownerName: 'Lead',
      role: 'viewer',
      visibility: 'private',
      locked: true,
      archivedAt: null,
      updatedAt: '2026-06-30T09:00:00.000Z',
      lastOpenedAt: null,
    },
  ],
  recent: [
    {
      id: 'owned-room',
      name: 'Owned Plan',
      ownerId: 'user-123',
      ownerName: 'Player',
      role: 'owner',
      visibility: 'private',
      locked: false,
      archivedAt: null,
      updatedAt: '2026-06-30T10:00:00.000Z',
      lastOpenedAt: '2026-06-30T11:00:00.000Z',
    },
  ],
};

function setDashboardLocation() {
  Object.defineProperty(window, 'location', {
    value: {
      ...window.location,
      pathname: '/dashboard',
      search: '',
      href: 'http://localhost:5173/dashboard',
      reload: vi.fn(),
    },
    writable: true,
  });
}

beforeEach(() => {
  setDashboardLocation();
  vi.mocked(listDocuments).mockReset();
  vi.mocked(createDocument).mockReset();
  vi.mocked(openDocument).mockReset();
  vi.mocked(listDocuments).mockResolvedValue(dashboardResponse);
  vi.mocked(createDocument).mockResolvedValue({ roomId: 'new-room' });
  vi.mocked(openDocument).mockResolvedValue(undefined);
  useAuthStore.setState({
    session: null,
    status: 'idle',
    errorMessage: null,
    noticeMessage: null,
  });
});

describe('DocumentDashboard', () => {
  it('does not render personal document groups for anonymous users', () => {
    // @covers AC-1
    useAuthStore.setState({ session: null, status: 'anonymous' });

    render(<DocumentDashboard />);

    expect(screen.getByText('Document dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('auth-panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open local board/i })).toBeInTheDocument();
    expect(screen.queryByText('Owned')).not.toBeInTheDocument();
    expect(listDocuments).not.toHaveBeenCalled();
  });

  it('renders owned, shared, and recent document groups for authenticated users', async () => {
    // @covers AC-3
    useAuthStore.setState({ session, status: 'authenticated' });

    render(<DocumentDashboard />);

    expect(await screen.findAllByText('Owned Plan')).toHaveLength(2);
    expect(screen.getByText('Shared Plan')).toBeInTheDocument();
    expect(screen.getByText('Owned')).toBeInTheDocument();
    expect(screen.getByText('Shared with me')).toBeInTheDocument();
    expect(screen.getByText('Recent')).toBeInTheDocument();
  });

  it('reloads the dashboard query when archived filter is enabled', async () => {
    // @covers AC-4
    const user = userEvent.setup();
    useAuthStore.setState({ session, status: 'authenticated' });

    render(<DocumentDashboard />);
    await screen.findAllByText('Owned Plan');
    await user.click(screen.getByLabelText('Include archived'));

    await waitFor(() => {
      expect(listDocuments).toHaveBeenLastCalledWith({
        search: '',
        status: 'all',
        includeArchived: true,
      });
    });
  });

  it('creates a document, records the open event, and navigates to the saved room URL', async () => {
    // @covers AC-5
    // @covers AC-7
    const user = userEvent.setup();
    const pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
    useAuthStore.setState({ session, status: 'authenticated' });

    render(<DocumentDashboard />);
    await screen.findAllByText('Owned Plan');
    await user.click(screen.getByRole('button', { name: /new document/i }));

    await waitFor(() => {
      expect(createDocument).toHaveBeenCalled();
      expect(openDocument).toHaveBeenCalledWith('new-room');
      expect(pushStateSpy).toHaveBeenCalledWith({}, '', '/?room=new-room');
      expect(window.location.reload).toHaveBeenCalled();
    });
  });
});
