import { useState } from 'react';
import { LogIn, LogOut, X } from 'lucide-react';
import { AuthPanel } from './AuthPanel';
import { useAuthStore, type AuthStoreState } from './auth.store';
import { getInitials } from '../utils/initials';

interface AuthMenuProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AuthMenu({ isOpen: controlledIsOpen, onOpenChange }: AuthMenuProps = {}) {
  const session = useAuthStore((state: AuthStoreState) => state.session);
  const status = useAuthStore((state: AuthStoreState) => state.status);
  const signOut = useAuthStore((state: AuthStoreState) => state.signOut);
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const isLoading = status === 'loading';
  const isOpen = controlledIsOpen ?? uncontrolledIsOpen;

  function setOpen(nextOpen: boolean) {
    if (onOpenChange) {
      onOpenChange(nextOpen);
      return;
    }

    setUncontrolledIsOpen(nextOpen);
  }

  if (!session) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-md border border-ink bg-paper px-3 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-panel"
        >
          <LogIn className="h-4 w-4" />
          Login
        </button>
        {isOpen ? <AuthPopover onClose={() => setOpen(false)} /> : null}
      </div>
    );
  }

  const label = session.user.name ?? session.user.email ?? 'Account';
  const initials = getInitials(label);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Account menu"
        onClick={() => setOpen(!isOpen)}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-primary bg-primary text-sm font-semibold text-paper shadow-sm transition-opacity hover:opacity-90"
      >
        {session.user.avatarUrl ? (
          <img src={session.user.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </button>
      {isOpen ? (
        <div className="absolute right-0 top-11 z-[80] w-64 rounded-lg border border-rule bg-paper p-3 text-ink shadow-lg">
          <div className="mb-3 flex items-center gap-3 rounded-md border border-rule bg-panel p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-paper">
              {session.user.avatarUrl ? (
                <img src={session.user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{label}</p>
              <p className="truncate text-xs text-muted">
                {session.user.email ?? session.user.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut().then(() => setOpen(false))}
            disabled={isLoading}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-ink bg-paper px-3 text-sm font-semibold text-ink transition-colors hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60"
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
    <div className="absolute right-0 top-11 z-[80] w-[min(360px,calc(100vw-24px))] rounded-lg border border-rule bg-paper p-4 text-ink shadow-lg">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Login</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-rule bg-paper text-muted hover:bg-panel"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <AuthPanel />
    </div>
  );
}
