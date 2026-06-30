import { create } from 'zustand';
import { createSupabaseAuthAdapter } from './supabase-auth-adapter';
import type { AuthAdapter, AuthCredentials, AuthSession } from './types';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous' | 'error';

export interface AuthStoreState {
  session: AuthSession | null;
  status: AuthStatus;
  errorMessage: string | null;
  noticeMessage: string | null;
  initAuth(): Promise<void>;
  refreshSession(): Promise<void>;
  signInWithPassword(credentials: AuthCredentials): Promise<void>;
  signUpWithPassword(credentials: AuthCredentials): Promise<void>;
  signOut(): Promise<void>;
}

export function createAuthStore(createAdapter: () => AuthAdapter) {
  let adapter: AuthAdapter | null = null;
  let unsubscribeSessionChange: (() => void) | null = null;

  function getAdapter(): AuthAdapter {
    adapter ??= createAdapter();
    return adapter;
  }

  return create<AuthStoreState>((set) => {
    function setSession(session: AuthSession | null): void {
      set({
        session,
        status: session ? 'authenticated' : 'anonymous',
        errorMessage: null,
        noticeMessage: null,
      });
    }

    function setError(error: unknown): void {
      set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Auth request failed.',
        noticeMessage: null,
      });
    }

    return {
      session: null,
      status: 'idle',
      errorMessage: null,
      noticeMessage: null,

      async initAuth() {
        set({ status: 'loading', errorMessage: null, noticeMessage: null });

        try {
          const authAdapter = getAdapter();

          unsubscribeSessionChange ??= authAdapter.onSessionChange(setSession);
          setSession(await authAdapter.getSession());
        } catch (error) {
          setError(error);
        }
      },

      async refreshSession() {
        set({ status: 'loading', errorMessage: null, noticeMessage: null });

        try {
          setSession(await getAdapter().refreshSession());
        } catch (error) {
          setError(error);
        }
      },

      async signInWithPassword(credentials) {
        set({ status: 'loading', errorMessage: null, noticeMessage: null });

        try {
          setSession(await getAdapter().signInWithPassword(credentials));
        } catch (error) {
          setError(error);
        }
      },

      async signUpWithPassword(credentials) {
        set({ status: 'loading', errorMessage: null, noticeMessage: null });

        try {
          const session = await getAdapter().signUpWithPassword(credentials);
          setSession(session);

          if (!session) {
            set({
              noticeMessage: 'Account created. Check your email to confirm it before signing in.',
            });
          }
        } catch (error) {
          setError(error);
        }
      },

      async signOut() {
        set({ status: 'loading', errorMessage: null, noticeMessage: null });

        try {
          await getAdapter().signOut();
          setSession(null);
        } catch (error) {
          setError(error);
        }
      },
    };
  });
}

export const useAuthStore = createAuthStore(() => createSupabaseAuthAdapter());
