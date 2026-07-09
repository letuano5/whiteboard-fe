import { Profiler } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuthStore } from '../../auth/auth.store';
import type { AuthSession } from '../../auth/types';
import { DocumentDashboard } from '../DocumentDashboard';
import { createDocument, listDocuments, openDocument } from '../document-api';

vi.mock('../../auth/AuthPanel', () => ({
  AuthPanel: () => <div data-testid="auth-panel" />,
}));

vi.mock('../../auth/AuthMenu', () => ({
  AuthMenu: () => <button aria-label="Account menu" type="button" />,
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

const otherSession: AuthSession = {
  accessToken: 'other-access-token',
  expiresAt: 456,
  user: {
    id: 'user-456',
    email: 'coach@example.com',
    name: 'Coach',
    avatarUrl: null,
  },
};

const dashboardResponse = {
  documents: [
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
      previewElements: [],
    },
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
      previewElements: [],
    },
  ],
  nextCursor: null,
};

const otherDashboardResponse = {
  documents: [
    {
      id: 'other-room',
      name: 'Other User Plan',
      ownerId: 'user-456',
      ownerName: 'Coach',
      role: 'owner',
      visibility: 'private',
      locked: false,
      archivedAt: null,
      updatedAt: '2026-07-01T10:00:00.000Z',
      lastOpenedAt: null,
      previewElements: [],
    },
  ],
  nextCursor: null,
};

const pagedDashboardResponse = {
  documents: [dashboardResponse.documents[0]],
  nextCursor: 'cursor-1',
};

const nextPageDashboardResponse = {
  documents: [
    {
      id: 'next-room',
      name: 'Next Page Plan',
      ownerId: 'user-123',
      ownerName: 'Player',
      role: 'editor',
      visibility: 'private',
      locked: false,
      archivedAt: null,
      updatedAt: '2026-07-01T12:00:00.000Z',
      lastOpenedAt: null,
      previewElements: [],
    },
  ],
  nextCursor: null,
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

async function waitForDashboardTimers() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

async function rejectAsLoggedOut(message = 'Authentication is required.'): Promise<never> {
  useAuthStore.setState({
    session: null,
    status: 'anonymous',
    errorMessage: null,
    noticeMessage: null,
  });
  throw new Error(message);
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
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
    expect(screen.queryByText('Owned by me')).not.toBeInTheDocument();
    expect(listDocuments).not.toHaveBeenCalled();
  });

  it('renders recent document cards for authenticated users', async () => {
    // @covers AC-3
    useAuthStore.setState({ session, status: 'authenticated' });

    render(<DocumentDashboard />);

    expect(await screen.findByText('Owned Plan')).toBeInTheDocument();
    expect(screen.getByText('Shared Plan')).toBeInTheDocument();
    expect(screen.getByText('Recent documents')).toBeInTheDocument();
    expect(screen.getByText('Owned by me')).toBeInTheDocument();
    expect(screen.getByText('Shared with me')).toBeInTheDocument();
    expect(screen.getByLabelText('Account menu')).toBeInTheDocument();
    expect(listDocuments).toHaveBeenCalledWith({
      search: '',
      scope: 'all',
      cursor: null,
      limit: 10,
    });
  });

  it('does not refetch when the session object and access token change for the same user', async () => {
    useAuthStore.setState({ session, status: 'authenticated' });

    render(<DocumentDashboard />);
    await screen.findByText('Owned Plan');

    act(() => {
      useAuthStore.setState({
        session: { ...session, accessToken: 'refreshed-token', expiresAt: 999 },
        status: 'authenticated',
      });
    });
    await waitForDashboardTimers();

    expect(screen.getByText('Owned Plan')).toBeInTheDocument();
    expect(listDocuments).toHaveBeenCalledTimes(1);
  });

  it('does not re-render the dashboard content when only the same user token changes', async () => {
    const renderSpy = vi.fn();
    useAuthStore.setState({ session, status: 'authenticated' });

    render(
      <Profiler id="dashboard" onRender={renderSpy}>
        <DocumentDashboard />
      </Profiler>,
    );
    await screen.findByText('Owned Plan');
    renderSpy.mockClear();

    act(() => {
      useAuthStore.setState({
        session: { ...session, accessToken: 'refreshed-token', expiresAt: 999 },
        status: 'authenticated',
      });
    });
    await waitForDashboardTimers();

    expect(renderSpy).not.toHaveBeenCalled();
    expect(listDocuments).toHaveBeenCalledTimes(1);
  });

  it('clears visible documents on logout without refetching the dashboard', async () => {
    useAuthStore.setState({ session, status: 'authenticated' });

    render(<DocumentDashboard />);
    await screen.findByText('Owned Plan');

    act(() => {
      useAuthStore.setState({ session: null, status: 'anonymous' });
    });
    await waitForDashboardTimers();

    expect(screen.getByText('Document dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Owned Plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Shared Plan')).not.toBeInTheDocument();
    expect(listDocuments).toHaveBeenCalledTimes(1);
  });

  it('fetches the first page for a different user after logout', async () => {
    vi.mocked(listDocuments)
      .mockResolvedValueOnce(dashboardResponse)
      .mockResolvedValueOnce(otherDashboardResponse);
    useAuthStore.setState({ session, status: 'authenticated' });

    render(<DocumentDashboard />);
    await screen.findByText('Owned Plan');

    act(() => {
      useAuthStore.setState({ session: null, status: 'anonymous' });
    });
    await waitForDashboardTimers();

    act(() => {
      useAuthStore.setState({ session: otherSession, status: 'authenticated' });
    });

    expect(await screen.findByText('Other User Plan')).toBeInTheDocument();
    expect(screen.queryByText('Owned Plan')).not.toBeInTheDocument();
    expect(listDocuments).toHaveBeenCalledTimes(2);
    expect(listDocuments).toHaveBeenLastCalledWith({
      search: '',
      scope: 'all',
      cursor: null,
      limit: 10,
    });
  });

  it('reloads the dashboard query when ownership filter changes', async () => {
    // @covers AC-4
    const user = userEvent.setup();
    useAuthStore.setState({ session, status: 'authenticated' });

    render(<DocumentDashboard />);
    await screen.findByText('Owned Plan');
    await user.click(screen.getByRole('button', { name: /shared with me/i }));

    await waitFor(() => {
      expect(listDocuments).toHaveBeenLastCalledWith({
        search: '',
        scope: 'shared',
        cursor: null,
        limit: 10,
      });
    });
    expect(listDocuments).toHaveBeenCalledTimes(2);
  });

  it('keeps the current document list visible while a filter refetch is pending', async () => {
    const user = userEvent.setup();
    const pendingFilter = createDeferred<typeof dashboardResponse>();
    vi.mocked(listDocuments)
      .mockResolvedValueOnce(dashboardResponse)
      .mockReturnValueOnce(pendingFilter.promise);
    useAuthStore.setState({ session, status: 'authenticated' });

    render(<DocumentDashboard />);
    await screen.findByText('Owned Plan');
    await user.click(screen.getByRole('button', { name: /shared with me/i }));

    await waitFor(() => {
      expect(listDocuments).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText('Owned Plan')).toBeInTheDocument();
    expect(screen.getByText('Shared Plan')).toBeInTheDocument();

    await act(async () => {
      pendingFilter.resolve(otherDashboardResponse);
    });

    expect(await screen.findByText('Other User Plan')).toBeInTheDocument();
  });

  it('appends the next page when loading more documents', async () => {
    const user = userEvent.setup();
    vi.mocked(listDocuments)
      .mockResolvedValueOnce(pagedDashboardResponse)
      .mockResolvedValueOnce(nextPageDashboardResponse);
    useAuthStore.setState({ session, status: 'authenticated' });

    render(<DocumentDashboard />);
    await screen.findByText('Owned Plan');
    await user.click(screen.getByRole('button', { name: /load more/i }));

    expect(await screen.findByText('Next Page Plan')).toBeInTheDocument();
    expect(screen.getByText('Owned Plan')).toBeInTheDocument();
    expect(listDocuments).toHaveBeenNthCalledWith(2, {
      search: '',
      scope: 'all',
      cursor: 'cursor-1',
      limit: 10,
    });
  });

  it('returns to the login screen when loading more loses authorization', async () => {
    const user = userEvent.setup();
    vi.mocked(listDocuments)
      .mockResolvedValueOnce(pagedDashboardResponse)
      .mockImplementationOnce(() => rejectAsLoggedOut('Authentication is required.'));
    useAuthStore.setState({ session, status: 'authenticated' });

    render(<DocumentDashboard />);
    await screen.findByText('Owned Plan');
    await user.click(screen.getByRole('button', { name: /load more/i }));

    expect(await screen.findByText('Document dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Owned Plan')).not.toBeInTheDocument();
    expect(listDocuments).toHaveBeenCalledTimes(2);
  });

  it('returns to the login screen when opening a document loses authorization', async () => {
    const user = userEvent.setup();
    vi.mocked(openDocument).mockImplementationOnce(() => rejectAsLoggedOut('Room access denied.'));
    useAuthStore.setState({ session, status: 'authenticated' });

    render(<DocumentDashboard />);
    await screen.findByText('Owned Plan');
    await user.click(screen.getAllByRole('button', { name: /open owned plan/i })[0]);

    expect(await screen.findByText('Document dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Owned Plan')).not.toBeInTheDocument();
    expect(openDocument).toHaveBeenCalledWith('owned-room');
  });

  it('returns to the login screen when a filter refetch loses authorization', async () => {
    const user = userEvent.setup();
    vi.mocked(listDocuments)
      .mockResolvedValueOnce(dashboardResponse)
      .mockImplementationOnce(() => rejectAsLoggedOut('Authentication is required.'));
    useAuthStore.setState({ session, status: 'authenticated' });

    render(<DocumentDashboard />);
    await screen.findByText('Owned Plan');
    await user.click(screen.getByRole('button', { name: /shared with me/i }));

    expect(await screen.findByText('Document dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Owned Plan')).not.toBeInTheDocument();
    expect(listDocuments).toHaveBeenCalledTimes(2);
  });

  it('creates a document, records the open event, and navigates to the saved room URL', async () => {
    // @covers AC-5
    // @covers AC-7
    const user = userEvent.setup();
    const pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
    useAuthStore.setState({ session, status: 'authenticated' });

    render(<DocumentDashboard />);
    await screen.findByText('Owned Plan');
    await user.click(screen.getByRole('button', { name: /new document/i }));

    await waitFor(() => {
      expect(createDocument).toHaveBeenCalled();
      expect(openDocument).toHaveBeenCalledWith('new-room');
      expect(pushStateSpy).toHaveBeenCalledWith({}, '', '/?room=new-room');
      expect(window.location.reload).toHaveBeenCalled();
    });
  });
});
