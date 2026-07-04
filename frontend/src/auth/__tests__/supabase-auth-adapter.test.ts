import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseAuthAdapter } from '../supabase-auth-adapter';

const authChangeSubscription = {
  data: {
    subscription: {
      unsubscribe: vi.fn(),
    },
  },
};

const session = {
  access_token: 'access-token-123',
  expires_at: 123456,
  user: {
    id: 'user-123',
    email: 'player@example.com',
    user_metadata: {
      name: 'Tactical Player',
      avatar_url: 'https://example.test/avatar.png',
    },
  },
};

const mockSupabaseClient = {
  auth: {
    getSession: vi.fn(),
    refreshSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

beforeEach(() => {
  mockSupabaseClient.auth.getSession.mockReset();
  mockSupabaseClient.auth.refreshSession.mockReset();
  mockSupabaseClient.auth.signInWithPassword.mockReset();
  mockSupabaseClient.auth.signUp.mockReset();
  mockSupabaseClient.auth.signOut.mockReset();
  mockSupabaseClient.auth.onAuthStateChange.mockReset();
  authChangeSubscription.data.subscription.unsubscribe.mockReset();
});

describe('getSupabaseClient', () => {
  it('creates a persisted Supabase auth client from Vite env', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_PUBLIC_URL', 'http://localhost:8000');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');

    const supabaseModule = await import('@supabase/supabase-js');
    const adapterModule = await import('../supabase-auth-adapter');

    adapterModule.getSupabaseClient();

    expect(supabaseModule.createClient).toHaveBeenCalledWith('http://localhost:8000', 'anon-key', {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  });
});

describe('createSupabaseAuthAdapter', () => {
  it('maps restored sessions to provider-neutral auth state', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    const adapter = createSupabaseAuthAdapter(mockSupabaseClient);

    await expect(adapter.getSession()).resolves.toEqual({
      accessToken: 'access-token-123',
      expiresAt: 123456,
      user: {
        id: 'user-123',
        email: 'player@example.com',
        name: 'Tactical Player',
        avatarUrl: 'https://example.test/avatar.png',
      },
    });
  });

  it('logs in with email and password through Supabase auth', async () => {
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { session },
      error: null,
    });
    const adapter = createSupabaseAuthAdapter(mockSupabaseClient);

    await adapter.signInWithPassword({ email: 'player@example.com', password: 'secret' });

    expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'secret',
    });
  });

  it('registers with email and password through Supabase auth', async () => {
    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: { session },
      error: null,
    });
    const adapter = createSupabaseAuthAdapter(mockSupabaseClient);

    await adapter.signUpWithPassword({ email: 'player@example.com', password: 'secret' });

    expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'secret',
    });
  });

  it('returns null when registration requires confirmation before a session exists', async () => {
    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const adapter = createSupabaseAuthAdapter(mockSupabaseClient);

    await expect(
      adapter.signUpWithPassword({ email: 'player@example.com', password: 'secret' }),
    ).resolves.toBeNull();
  });

  it('refreshes and clears sessions through the same adapter boundary', async () => {
    mockSupabaseClient.auth.refreshSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });
    const adapter = createSupabaseAuthAdapter(mockSupabaseClient);

    await expect(adapter.refreshSession()).resolves.toMatchObject({
      accessToken: 'access-token-123',
    });
    await adapter.signOut();

    expect(mockSupabaseClient.auth.signOut).toHaveBeenCalledOnce();
  });

  it('subscribes to auth state changes and exposes unsubscribe', () => {
    const listener = vi.fn();
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue(authChangeSubscription);
    const adapter = createSupabaseAuthAdapter(mockSupabaseClient);

    const unsubscribe = adapter.onSessionChange(listener);
    const authListener = mockSupabaseClient.auth.onAuthStateChange.mock.calls[0]?.[0];

    expect(authListener).toBeDefined();
    authListener?.('SIGNED_IN', session);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'access-token-123' }),
    );

    unsubscribe();
    expect(authChangeSubscription.data.subscription.unsubscribe).toHaveBeenCalledOnce();
  });

  it('surfaces provider errors as ordinary Error instances', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Auth service unavailable.' },
    });
    const adapter = createSupabaseAuthAdapter(mockSupabaseClient);

    await expect(adapter.getSession()).rejects.toThrow('Auth service unavailable.');
  });
});
