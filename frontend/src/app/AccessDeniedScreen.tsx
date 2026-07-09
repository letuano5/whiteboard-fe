import { AlertTriangle, Menu } from 'lucide-react';
import { AuthMenu } from '../auth/AuthMenu';
import { dashboardPath, navigate } from './routing';

interface AccessDeniedScreenProps {
  isAuthenticated: boolean;
  message: string;
  code: string | null;
}

export function AccessDeniedScreen({ isAuthenticated, message, code }: AccessDeniedScreenProps) {
  const title = isAuthenticated ? "You don't have access" : 'Login required';
  const body = isAuthenticated
    ? 'This board is private. Ask the owner to add your email before opening it.'
    : 'This board is private. Login with an account that has access to open it.';

  return (
    <div className="grid min-h-screen place-items-center bg-paper px-4 text-ink">
      <button
        type="button"
        onClick={() => navigate(dashboardPath())}
        className="absolute left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-rule bg-paper text-ink shadow-md hover:bg-panel focus:outline-none focus:ring-2 focus:ring-primary-soft focus:ring-offset-2"
        aria-label="Open dashboard"
        title="Open dashboard"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="absolute right-4 top-4">
        <AuthMenu />
      </div>
      <section className="w-[min(440px,calc(100vw-32px))] rounded-lg border border-rule bg-paper p-6 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-warning-soft text-warning">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="text-xs font-semibold uppercase text-muted">{code ?? 'room-access'}</p>
        <h1 className="mt-2 text-xl font-semibold text-ink">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
        <p
          role="alert"
          className="mt-4 rounded-md border border-warning-border bg-warning-soft p-3 text-sm text-warning"
        >
          {message}
        </p>
      </section>
    </div>
  );
}
