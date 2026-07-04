import { FileText, FolderOpen, Loader2 } from 'lucide-react';
import { AuthPanel } from '../auth/AuthPanel';

export function DocumentDashboardLogin({ isCheckingAuth }: { isCheckingAuth: boolean }) {
  return (
    <main className="min-h-screen bg-[#f6f7f8] px-6 py-8 text-[#202124]">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1fr_380px]">
        <section className="self-start rounded-lg border border-[#d8dde2] bg-white p-6 shadow-sm">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#173f35] text-white">
            {isCheckingAuth ? <Loader2 className="h-5 w-5 animate-spin" /> : <FolderOpen />}
          </div>
          <h1 className="text-2xl font-semibold">Document dashboard</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#5f6670]">
            Sign in to view saved documents. Anonymous work stays on the local board until you
            choose Login to save.
          </p>
          <button
            type="button"
            onClick={() => {
              window.history.pushState({}, '', '/');
              window.location.reload();
            }}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-[#173f35] bg-white px-4 text-sm font-semibold text-[#173f35] hover:bg-[#edf5ef]"
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
