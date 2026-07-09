import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticatedFetch } from '../../auth/authenticated-fetch';
import { useAuthStore } from '../../auth/auth.store';
import type { AuthSession } from '../../auth/types';
import {
  createDocument,
  listDocuments,
  openDocument,
  renameDocument,
  archiveDocument,
  deleteDocument,
} from '../document-api';

vi.mock('../../auth/authenticated-fetch', () => ({
  authenticatedFetch: vi.fn(),
}));

const dashboardResponse = {
  documents: [
    {
      id: 'owned-room',
      name: 'Owned Plan',
      ownerId: 'user-123',
      ownerName: 'Owner User',
      role: 'owner',
      visibility: 'private',
      locked: false,
      archivedAt: null,
      updatedAt: '2026-06-30T10:00:00.000Z',
      lastOpenedAt: '2026-06-30T11:00:00.000Z',
      previewElements: [],
    },
  ],
  nextCursor: 'cursor-next',
};

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

beforeEach(() => {
  vi.mocked(authenticatedFetch).mockReset();
  useAuthStore.setState({
    session: null,
    status: 'idle',
    errorMessage: null,
    noticeMessage: null,
  });
});

describe('document dashboard API client', () => {
  it('lists accessible documents with search, ownership scope, limit, and cursor', async () => {
    // @covers AC-2
    // @covers AC-4
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(JSON.stringify(dashboardResponse), { status: 200 }),
    );

    await expect(
      listDocuments({ search: 'briefing', scope: 'shared', cursor: 'cursor-1', limit: 10 }),
    ).resolves.toEqual(dashboardResponse);

    expect(authenticatedFetch).toHaveBeenCalledWith(
      '/api/documents?search=briefing&scope=shared&cursor=cursor-1&limit=10',
    );
  });

  it('creates a new dashboard document', async () => {
    // @covers AC-5
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(JSON.stringify({ roomId: 'room-created' }), { status: 201 }),
    );

    await expect(createDocument('Operation Map')).resolves.toEqual({ roomId: 'room-created' });

    expect(authenticatedFetch).toHaveBeenCalledWith('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Operation Map' }),
    });
  });

  it('records document open before navigation', async () => {
    // @covers AC-7
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    await openDocument('room-opened');

    expect(authenticatedFetch).toHaveBeenCalledWith('/api/documents/room-opened/open', {
      method: 'POST',
    });
  });

  it('sends owner/admin management actions through document endpoints', async () => {
    // @covers AC-6
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(dashboardResponse.documents[0])))
      .mockResolvedValueOnce(new Response(JSON.stringify(dashboardResponse.documents[0])))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));

    await renameDocument('room-owned', 'Renamed');
    await archiveDocument('room-owned', true);
    await deleteDocument('room-owned');

    expect(authenticatedFetch).toHaveBeenNthCalledWith(1, '/api/documents/room-owned', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed' }),
    });
    expect(authenticatedFetch).toHaveBeenNthCalledWith(2, '/api/documents/room-owned', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true }),
    });
    expect(authenticatedFetch).toHaveBeenNthCalledWith(3, '/api/documents/room-owned', {
      method: 'DELETE',
    });
  });

  it('clears the auth session when a dashboard request becomes unauthenticated', async () => {
    useAuthStore.setState({ session, status: 'authenticated' });
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'documents/unauthenticated', message: 'Authentication is required.' },
        }),
        { status: 401 },
      ),
    );

    await expect(listDocuments()).rejects.toThrow('Authentication is required.');

    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('clears the auth session when a document action loses access', async () => {
    useAuthStore.setState({ session, status: 'authenticated' });
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'documents/forbidden', message: 'Room access denied.' } }),
        { status: 403 },
      ),
    );

    await expect(openDocument('room-owned')).rejects.toThrow('Room access denied.');

    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('keeps the auth session for non-auth document errors', async () => {
    useAuthStore.setState({ session, status: 'authenticated' });
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'documents/not-found', message: 'Document was not found.' },
        }),
        { status: 404 },
      ),
    );

    await expect(openDocument('missing-room')).rejects.toThrow('Document was not found.');

    expect(useAuthStore.getState().session).toEqual(session);
    expect(useAuthStore.getState().status).toBe('authenticated');
  });
});
