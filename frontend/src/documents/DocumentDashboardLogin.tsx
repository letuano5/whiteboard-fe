import { FileText, Loader2 } from 'lucide-react';
import { AuthPanel } from '../auth/AuthPanel';
import { homePath } from '../app/routing';

// Signature illustration approved in the login mockup: what the canvas actually
// draws (sticky note, ellipse, freehand squiggle, arrow) instead of a brand icon.
function PitchScene() {
  return (
    <svg className="mb-8 h-[110px] w-[186px]" viewBox="0 0 220 130" fill="none" aria-hidden="true">
      <rect
        x="14"
        y="18"
        width="72"
        height="58"
        rx="6"
        transform="rotate(-4 50 47)"
        fill="#fff4cf"
        stroke="#d8b34a"
        strokeWidth="1.5"
      />
      <path
        d="M28 42h44M28 54h30"
        transform="rotate(-4 50 47)"
        stroke="#a9873a"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx="150" cy="40" rx="30" ry="22" fill="none" stroke="#3b6fd6" strokeWidth="2.5" />
      <path
        d="M18 100c10-14 20 12 32-2s18-16 30-2 22 10 34-4 24-14 34 0"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M92 46c14-4 24-4 32 2"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M118 44l7 3-2 7"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DocumentDashboardLogin({ isCheckingAuth }: { isCheckingAuth: boolean }) {
  return (
    <main className="min-h-screen w-screen bg-paper text-ink">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-6 py-8 md:grid-cols-[1.15fr_0.85fr]">
        <section className="canvas-grid rounded-lg border border-rule bg-paper p-6 md:p-8">
          <PitchScene />
          <p className="mb-6 flex items-center gap-2 text-sm font-bold text-ink">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />
            Whiteboard
            {isCheckingAuth ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : null}
          </p>
          <h1 className="max-w-xl text-4xl font-bold tracking-tight text-ink">
            Document dashboard
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">
            Sign in to view saved documents. Anonymous work stays on the local board until you
            choose Login to save.
          </p>
          <button
            type="button"
            onClick={() => {
              window.history.pushState({}, '', homePath());
              window.location.reload();
            }}
            className="mt-8 flex h-12 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-paper transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary-soft focus:ring-offset-2"
          >
            <FileText className="h-4 w-4" />
            Open local board
          </button>
        </section>

        <AuthPanel />
      </div>
    </main>
  );
}
