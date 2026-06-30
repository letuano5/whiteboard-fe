import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth.store';
import { authenticatedFetch, createAuthenticatedHeaders } from '../authenticated-fetch';
import type { AuthSession } from '../types';

const session: AuthSession = {
  accessToken: 'access-token-123',
  expiresAt: 123456,
  user: {
    id: 'user-123',
    email: 'player@example.com',
    name: 'Tactical Player',
    avatarUrl: null,
  },
};

afterEach(() => {
  useAuthStore.setState({ session: null, status: 'idle', errorMessage: null });
  vi.unstubAllGlobals();
});

describe('createAuthenticatedHeaders', () => {
  it('adds a bearer token when the auth store has a session', () => {
    useAuthStore.setState({ session, status: 'authenticated', errorMessage: null });

    const headers = createAuthenticatedHeaders({ Accept: 'application/json' });

    expect(headers.get('Authorization')).toBe('Bearer access-token-123');
    expect(headers.get('Accept')).toBe('application/json');
  });

  it('preserves caller headers and omits Authorization when there is no token', () => {
    const headers = createAuthenticatedHeaders({ Accept: 'application/json' });

    expect(headers.has('Authorization')).toBe(false);
    expect(headers.get('Accept')).toBe('application/json');
  });
});

describe('authenticatedFetch', () => {
  it('calls fetch with authenticated headers', async () => {
    useAuthStore.setState({ session, status: 'authenticated', errorMessage: null });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await authenticatedFetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toBeInstanceOf(Headers);
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer access-token-123');
    expect((init.headers as Headers).get('Content-Type')).toBe('application/json');
  });
});
