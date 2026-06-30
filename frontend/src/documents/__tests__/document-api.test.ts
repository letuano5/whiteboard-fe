import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticatedFetch } from '../../auth/authenticated-fetch';
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
  owned: [
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
    },
  ],
  sharedWithMe: [],
  recent: [],
};

beforeEach(() => {
  vi.mocked(authenticatedFetch).mockReset();
});

describe('document dashboard API client', () => {
  it('lists accessible documents with search/status/archived filters', async () => {
    // @covers AC-2
    // @covers AC-4
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(JSON.stringify(dashboardResponse), { status: 200 }),
    );

    await expect(
      listDocuments({ search: 'briefing', status: 'shared', includeArchived: true }),
    ).resolves.toEqual(dashboardResponse);

    expect(authenticatedFetch).toHaveBeenCalledWith(
      '/api/documents?search=briefing&includeArchived=true&status=shared',
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
      .mockResolvedValueOnce(new Response(JSON.stringify(dashboardResponse.owned[0])))
      .mockResolvedValueOnce(new Response(JSON.stringify(dashboardResponse.owned[0])))
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
});
