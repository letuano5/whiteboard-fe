import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { KeyRound, Loader2, LogIn, LogOut, ShieldCheck, UserPlus } from 'lucide-react';
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
    <section className="rounded-lg border border-[#b7c7b7] bg-[#fbfdf9]/95 p-5 shadow-[0_20px_60px_rgba(28,41,33,0.12)]">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[#68766a]">Operator access</p>
          <h2 className="mt-1 text-xl font-semibold text-[#18231d]">
            {mode === 'sign-up' ? 'Create account' : 'Sign in'}
          </h2>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#173f35] text-white">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <KeyRound className="h-5 w-5" />
          )}
        </div>
      </div>

      {session ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-[#cbd9cb] bg-white p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[#16735c]" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#18231d]">
                  {session.user.name ?? session.user.email ?? 'Signed in'}
                </p>
                <p className="truncate text-xs text-[#68766a]">
                  {session.user.email ?? session.user.id}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={isLoading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#173f35] bg-white px-4 text-sm font-semibold text-[#173f35] transition-colors hover:bg-[#edf5ef] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid h-10 grid-cols-2 rounded-lg border border-[#b7c7b7] bg-white p-1">
            <button
              type="button"
              onClick={() => setMode('sign-in')}
              className={`rounded-md text-sm font-semibold transition-colors ${
                mode === 'sign-in' ? 'bg-[#173f35] text-white' : 'text-[#314039] hover:bg-[#edf5ef]'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('sign-up')}
              className={`rounded-md text-sm font-semibold transition-colors ${
                mode === 'sign-up' ? 'bg-[#173f35] text-white' : 'text-[#314039] hover:bg-[#edf5ef]'
              }`}
            >
              Register
            </button>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-[#314039]">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
              className="mt-1 h-11 w-full rounded-lg border border-[#b7c7b7] bg-white px-3 text-[#18231d] outline-none transition-colors focus:border-[#2457c5] focus:ring-2 focus:ring-[#2457c5]/20"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#314039]">Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 h-11 w-full rounded-lg border border-[#b7c7b7] bg-white px-3 text-[#18231d] outline-none transition-colors focus:border-[#2457c5] focus:ring-2 focus:ring-[#2457c5]/20"
            />
          </label>
          <button
            type="submit"
            disabled={isLoading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#173f35] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0f2d26] disabled:cursor-not-allowed disabled:opacity-60"
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
          className="mt-4 rounded-lg border border-[#9dc9af] bg-[#eef8f1] px-3 py-2 text-sm text-[#1f5b41]"
        >
          {noticeMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-[#dfb86a] bg-[#fff8e8] px-3 py-2 text-sm text-[#795014]"
        >
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
