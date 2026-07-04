import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticatedFetch } from '../../auth/authenticated-fetch';
import { exportNativeFileFromRoom, importNativeFileToRoom } from '../file-lifecycle-api';
import { buildNativeFileDocument } from '../native-file';

vi.mock('../../auth/authenticated-fetch', () => ({
  authenticatedFetch: vi.fn(),
}));

const document = buildNativeFileDocument({
  elements: [],
  camera: { x: 0, y: 0, zoom: 1 },
  room: { id: 'room-1', name: null, source: 'saved' },
});

beforeEach(() => {
  vi.mocked(authenticatedFetch).mockReset();
});

describe('native file import API client', () => {
  it('posts native imports to the saved-room endpoint', async () => {
    // @covers AC-3
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(JSON.stringify({ importedElementCount: 0, documentClock: null }), {
        status: 200,
      }),
    );

    await expect(importNativeFileToRoom('room-1', document, 'merge')).resolves.toEqual({
      importedElementCount: 0,
      documentClock: null,
    });

    expect(authenticatedFetch).toHaveBeenCalledWith('/api/rooms/room-1/import-native', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document, mode: 'merge' }),
    });
  });

  it('surfaces server permission errors', async () => {
    // @covers AC-3
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: 'Editor or owner access is required to import into this document.' },
        }),
        { status: 403 },
      ),
    );

    await expect(importNativeFileToRoom('room-1', document, 'merge')).rejects.toThrow(
      'Editor or owner access is required to import into this document.',
    );
  });

  it('fetches saved native exports from the backend server-truth endpoint', async () => {
    // @covers AC-1
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(JSON.stringify({ document, documentClock: '7' }), { status: 200 }),
    );

    await expect(exportNativeFileFromRoom('room-1')).resolves.toEqual({
      document,
      documentClock: '7',
    });

    expect(authenticatedFetch).toHaveBeenCalledWith('/api/rooms/room-1/export-native');
  });
});
