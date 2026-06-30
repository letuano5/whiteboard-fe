import { useState } from 'react';
import { LogIn, LogOut, X } from 'lucide-react';
import { AuthPanel } from './AuthPanel';
import { useAuthStore, type AuthStoreState } from './auth.store';

export function AuthMenu() {
  const session = useAuthStore((state: AuthStoreState) => state.session);
  const status = useAuthStore((state: AuthStoreState) => state.status);
  const signOut = useAuthStore((state: AuthStoreState) => state.signOut);
  const [isOpen, setIsOpen] = useState(false);
  const isLoading = status === 'loading';

  if (!session) {
    return (
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-md border border-[#173f35] bg-white px-3 text-sm font-semibold text-[#173f35] shadow-sm transition-colors hover:bg-[#edf5ef]"
        >
          <LogIn className="h-4 w-4" />
          Login
        </button>
        {isOpen ? <AuthPopover onClose={() => setIsOpen(false)} /> : null}
      </div>
    );
  }

  const label = session.user.name ?? session.user.email ?? 'Account';
  const initials = getInitials(label);

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Account menu"
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#173f35] bg-[#173f35] text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0f2d26]"
      >
        {session.user.avatarUrl ? (
          <img src={session.user.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </button>
      {isOpen ? (
        <div className="absolute right-0 top-11 z-[80] w-64 rounded-lg border border-[#b7c7b7] bg-[#fbfdf9] p-3 text-[#18231d] shadow-[0_20px_60px_rgba(28,41,33,0.18)]">
          <div className="mb-3 flex items-center gap-3 rounded-md border border-[#cbd9cb] bg-white p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#173f35] text-sm font-semibold text-white">
              {session.user.avatarUrl ? (
                <img src={session.user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{label}</p>
              <p className="truncate text-xs text-[#68766a]">
                {session.user.email ?? session.user.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={isLoading}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#173f35] bg-white px-3 text-sm font-semibold text-[#173f35] transition-colors hover:bg-[#edf5ef] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AuthPopover({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute right-0 top-11 z-[80] w-[min(360px,calc(100vw-24px))] rounded-lg border border-[#b7c7b7] bg-[#fbfdf9] p-4 text-[#18231d] shadow-[0_20px_60px_rgba(28,41,33,0.18)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[#68766a]">Account</p>
          <h2 className="mt-1 text-lg font-semibold">Login</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#cbd9cb] bg-white text-[#314039] hover:bg-[#edf5ef]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <AuthPanel />
    </div>
  );
}

function getInitials(label: string): string {
  const parts = label
    .split(/[\s@._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return (parts[0]?.[0] ?? 'U').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}
