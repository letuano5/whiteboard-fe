import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthStore } from '../auth.store';
import type { AuthAdapter, AuthSession } from '../types';

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

function createAdapter(overrides: Partial<AuthAdapter> = {}) {
  let sessionListener: ((session: AuthSession | null) => void) | null = null;
  const adapter: AuthAdapter = {
    getSession: vi.fn().mockResolvedValue(null),
    refreshSession: vi.fn().mockResolvedValue(null),
    signInWithPassword: vi.fn().mockResolvedValue(session),
    signUpWithPassword: vi.fn().mockResolvedValue(session),
    signOut: vi.fn().mockResolvedValue(undefined),
    onSessionChange: vi.fn((listener) => {
      sessionListener = listener;
      return vi.fn();
    }),
    ...overrides,
  };

  return {
    adapter,
    emitSessionChange(nextSession: AuthSession | null) {
      sessionListener?.(nextSession);
    },
  };
}

describe('createAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores the current session and subscribes to provider auth changes', async () => {
    const { adapter } = createAdapter({
      getSession: vi.fn().mockResolvedValue(session),
    });
    const store = createAuthStore(() => adapter);

    await store.getState().initAuth();

    expect(adapter.onSessionChange).toHaveBeenCalledOnce();
    expect(store.getState()).toMatchObject({
      session,
      status: 'authenticated',
      errorMessage: null,
    });
  });

  it('keeps access token state after login and refresh', async () => {
    const refreshedSession = { ...session, accessToken: 'refreshed-token' };
    const { adapter } = createAdapter({
      signInWithPassword: vi.fn().mockResolvedValue(session),
      refreshSession: vi.fn().mockResolvedValue(refreshedSession),
    });
    const store = createAuthStore(() => adapter);

    await store.getState().signInWithPassword({ email: 'player@example.com', password: 'secret' });
    expect(store.getState().session?.accessToken).toBe('access-token-123');

    await store.getState().refreshSession();
    expect(store.getState().session?.accessToken).toBe('refreshed-token');
  });

  it('keeps access token state after registration returns a session', async () => {
    const { adapter } = createAdapter({
      signUpWithPassword: vi.fn().mockResolvedValue(session),
    });
    const store = createAuthStore(() => adapter);

    await store.getState().signUpWithPassword({ email: 'player@example.com', password: 'secret' });

    expect(adapter.signUpWithPassword).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'secret',
    });
    expect(store.getState()).toMatchObject({
      session,
      status: 'authenticated',
      noticeMessage: null,
    });
  });

  it('shows a confirmation notice when registration returns no session', async () => {
    const { adapter } = createAdapter({
      signUpWithPassword: vi.fn().mockResolvedValue(null),
    });
    const store = createAuthStore(() => adapter);

    await store.getState().signUpWithPassword({ email: 'player@example.com', password: 'secret' });

    expect(store.getState()).toMatchObject({
      session: null,
      status: 'anonymous',
      noticeMessage: 'Account created. Check your email to confirm it before signing in.',
    });
  });

  it('clears session state after logout', async () => {
    const { adapter } = createAdapter({
      getSession: vi.fn().mockResolvedValue(session),
    });
    const store = createAuthStore(() => adapter);

    await store.getState().initAuth();
    await store.getState().signOut();

    expect(adapter.signOut).toHaveBeenCalledOnce();
    expect(store.getState()).toMatchObject({
      session: null,
      status: 'anonymous',
      errorMessage: null,
    });
  });

  it('updates from provider auth-state changes', async () => {
    const { adapter, emitSessionChange } = createAdapter();
    const store = createAuthStore(() => adapter);

    await store.getState().initAuth();
    emitSessionChange(session);

    expect(store.getState()).toMatchObject({
      session,
      status: 'authenticated',
    });
  });

  it('keeps auth errors in store state', async () => {
    const { adapter } = createAdapter({
      getSession: vi.fn().mockRejectedValue(new Error('Auth config missing.')),
    });
    const store = createAuthStore(() => adapter);

    await store.getState().initAuth();

    expect(store.getState()).toMatchObject({
      session: null,
      status: 'error',
      errorMessage: 'Auth config missing.',
    });
  });
});
