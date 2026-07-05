import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, LogIn, LogOut, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuthStore, type AuthStoreState } from './auth.store';

interface AuthPanelProps {
  useStore?: typeof useAuthStore;
}

export function AuthPanel({ useStore = useAuthStore }: AuthPanelProps) {
  const session = useStore((state: AuthStoreState) => state.session);
  const status = useStore((state: AuthStoreState) => state.status);
  const errorMessage = useStore((state: AuthStoreState) => state.errorMessage);
  const noticeMessage = useStore((state: AuthStoreState) => state.noticeMessage);
  const initAuth = useStore((state: AuthStoreState) => state.initAuth);
  const signInWithPassword = useStore((state: AuthStoreState) => state.signInWithPassword);
  const signUpWithPassword = useStore((state: AuthStoreState) => state.signUpWithPassword);
  const signOut = useStore((state: AuthStoreState) => state.signOut);
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === 'sign-up') {
      await signUpWithPassword({ email, password });
    } else {
      await signInWithPassword({ email, password });
    }
    setPassword('');
  }

  const isLoading = status === 'loading';

  return (
    <section className="rounded-lg border border-rule bg-paper p-5">
      <div className="mb-5 flex items-center gap-2">
        <h2 className="text-xl font-semibold text-ink">
          {mode === 'sign-up' ? 'Create account' : 'Sign in'}
        </h2>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : null}
      </div>

      {session ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-rule bg-panel p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-notice" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {session.user.name ?? session.user.email ?? 'Signed in'}
                </p>
                <p className="truncate text-xs text-muted">
                  {session.user.email ?? session.user.id}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={isLoading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-ink bg-paper px-4 text-sm font-semibold text-ink transition-colors hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid h-10 grid-cols-2 rounded-lg border border-rule bg-paper p-1">
            <button
              type="button"
              onClick={() => setMode('sign-in')}
              className={`rounded-md text-sm font-semibold transition-colors ${
                mode === 'sign-in' ? 'bg-primary text-paper' : 'text-muted hover:bg-panel'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('sign-up')}
              className={`rounded-md text-sm font-semibold transition-colors ${
                mode === 'sign-up' ? 'bg-primary text-paper' : 'text-muted hover:bg-panel'
              }`}
            >
              Register
            </button>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-muted">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
              className="mt-1 h-11 w-full rounded-lg border border-field-border bg-paper px-3 text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-muted">Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              required
              className="mt-1 h-11 w-full rounded-lg border border-field-border bg-paper px-3 text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
            />
          </label>
          <button
            type="submit"
            disabled={isLoading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === 'sign-up' ? (
              <UserPlus className="h-4 w-4" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {mode === 'sign-up' ? 'Create account' : 'Sign in'}
          </button>
        </form>
      )}

      {noticeMessage ? (
        <p
          role="status"
          className="mt-4 rounded-lg border border-notice-border bg-notice-soft px-3 py-2 text-sm text-notice"
        >
          {noticeMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning"
        >
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
