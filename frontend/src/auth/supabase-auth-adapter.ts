import { createClient } from '@supabase/supabase-js';
import type { AuthAdapter, AuthCredentials, AuthSession } from './types';
import { AuthConfigurationError } from './types';

interface SupabaseConfig {
  publicUrl: string;
  anonKey: string;
}

interface SupabaseAuthError {
  message: string;
}

interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

interface SupabaseSession {
  access_token: string;
  expires_at?: number | null;
  user: SupabaseUser;
}

interface SupabaseSessionResult {
  data: {
    session: SupabaseSession | null;
  };
  error: SupabaseAuthError | null;
}

interface SupabaseSignOutResult {
  error: SupabaseAuthError | null;
}

interface SupabaseAuthChangeSubscription {
  data: {
    subscription: {
      unsubscribe(): void;
    };
  };
}

interface SupabaseAuthLike {
  auth: {
    getSession(): Promise<SupabaseSessionResult>;
    refreshSession(): Promise<SupabaseSessionResult>;
    signInWithPassword(credentials: AuthCredentials): Promise<SupabaseSessionResult>;
    signUp(credentials: AuthCredentials): Promise<SupabaseSessionResult>;
    signOut(): Promise<SupabaseSignOutResult>;
    onAuthStateChange(
      listener: (event: string, session: SupabaseSession | null) => void,
    ): SupabaseAuthChangeSubscription;
  };
}

let supabaseClient: SupabaseAuthLike | null = null;

export function getSupabaseConfig(): SupabaseConfig {
  const publicUrl = import.meta.env.VITE_SUPABASE_PUBLIC_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!publicUrl || !anonKey) {
    throw new AuthConfigurationError(
      'Supabase auth is missing VITE_SUPABASE_PUBLIC_URL or VITE_SUPABASE_ANON_KEY.',
    );
  }

  return { publicUrl, anonKey };
}

export function getSupabaseClient(): SupabaseAuthLike {
  if (!supabaseClient) {
    const config = getSupabaseConfig();
    supabaseClient = createClient(config.publicUrl, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return supabaseClient;
}

export function createSupabaseAuthAdapter(
  client: SupabaseAuthLike = getSupabaseClient(),
): AuthAdapter {
  return {
    async getSession() {
      const result = await client.auth.getSession();
      assertNoAuthError(result.error);
      return mapSession(result.data.session);
    },

    async refreshSession() {
      const result = await client.auth.refreshSession();
      assertNoAuthError(result.error);
      return mapSession(result.data.session);
    },

    async signInWithPassword(credentials) {
      const result = await client.auth.signInWithPassword(credentials);
      assertNoAuthError(result.error);
      return mapSession(result.data.session);
    },

    async signUpWithPassword(credentials) {
      const result = await client.auth.signUp(credentials);
      assertNoAuthError(result.error);
      return mapSession(result.data.session);
    },

    async signOut() {
      const result = await client.auth.signOut();
      assertNoAuthError(result.error);
    },

    onSessionChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        listener(mapSession(session));
      });

      return () => data.subscription.unsubscribe();
    },
  };
}

function assertNoAuthError(error: SupabaseAuthError | null): void {
  if (error) {
    throw new Error(error.message);
  }
}

function mapSession(session: SupabaseSession | null): AuthSession | null {
  if (!session) {
    return null;
  }

  return {
    accessToken: session.access_token,
    expiresAt: session.expires_at ?? null,
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
      name: readMetadataString(session.user.user_metadata, 'name'),
      avatarUrl: readMetadataString(session.user.user_metadata, 'avatar_url'),
    },
  };
}

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
