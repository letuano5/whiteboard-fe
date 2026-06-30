import { useEffect, useMemo, useState } from 'react';
import { FileText, FolderOpen, Loader2, Plus, Search } from 'lucide-react';
import { AuthPanel } from '../auth/AuthPanel';
import { useAuthStore, type AuthStoreState } from '../auth/auth.store';
import {
  archiveDocument,
  createDocument,
  deleteDocument,
  listDocuments,
  openDocument,
  renameDocument,
  type DashboardDocument,
  type DocumentDashboardResponse,
} from './document-api';
import { DocumentSection } from './DocumentSection';

const EMPTY_DASHBOARD: DocumentDashboardResponse = {
  owned: [],
  sharedWithMe: [],
  recent: [],
};

export function DocumentDashboard() {
  const session = useAuthStore((state: AuthStoreState) => state.session);
  const status = useAuthStore((state: AuthStoreState) => state.status);
  const initAuth = useAuthStore((state: AuthStoreState) => state.initAuth);
  const [dashboard, setDashboard] = useState<DocumentDashboardResponse>(EMPTY_DASHBOARD);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'shared' | 'locked'>('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'idle') {
      void initAuth();
    }
  }, [initAuth, status]);

  useEffect(() => {
    if (!session) return;

    let isCurrent = true;
    void listDocuments({ search, status: statusFilter, includeArchived })
      .then((result) => {
        if (isCurrent) {
          setDashboard(result);
          setErrorMessage(null);
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not load documents.');
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [includeArchived, search, session, statusFilter]);

  async function handleCreateDocument() {
    await runAction(async () => {
      const result = await createDocument();
      await openAndNavigate(result.roomId);
    });
  }

  async function handleOpenDocument(roomId: string) {
    await runAction(() => openAndNavigate(roomId));
  }

  async function handleRenameDocument(document: DashboardDocument) {
    const name = window.prompt('Rename document', document.name);
    if (name === null) return;
    await runAction(async () => {
      await renameDocument(document.id, name);
      setDashboard(await listDocuments({ search, status: statusFilter, includeArchived }));
    });
  }

  async function handleArchiveDocument(document: DashboardDocument) {
    await runAction(async () => {
      await archiveDocument(document.id, !document.archivedAt);
      setDashboard(await listDocuments({ search, status: statusFilter, includeArchived }));
    });
  }

  async function handleDeleteDocument(document: DashboardDocument) {
    if (!window.confirm(`Delete ${document.name}?`)) return;
    await runAction(async () => {
      await deleteDocument(document.id);
      setDashboard(await listDocuments({ search, status: statusFilter, includeArchived }));
    });
  }

  async function runAction(action: () => Promise<void>) {
    setErrorMessage(null);
    try {
      await action();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Document action failed.');
    }
  }

  async function openAndNavigate(roomId: string) {
    await openDocument(roomId);
    window.history.pushState({}, '', '/?room=' + roomId);
    window.location.reload();
  }

  const isCheckingAuth = status === 'idle' || status === 'loading';
  const totalCount = useMemo(
    () => dashboard.owned.length + dashboard.sharedWithMe.length,
    [dashboard],
  );

  if (!session) {
    return (
      <main className="min-h-screen bg-[#f5f7f6] px-6 py-8 text-[#18231d]">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1fr_380px]">
          <section className="self-start rounded-lg border border-[#c8d6cf] bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#173f35] text-white">
              {isCheckingAuth ? <Loader2 className="h-5 w-5 animate-spin" /> : <FolderOpen />}
            </div>
            <h1 className="text-2xl font-semibold">Document dashboard</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#526057]">
              Sign in to view owned, shared, and recent saved documents. Anonymous work stays on the
              local board and does not expose a personal dashboard.
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

  return (
    <main className="min-h-screen bg-[#f5f7f6] text-[#18231d]">
      <header className="border-b border-[#d7e0da] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-[#68766a]">Workspace</p>
            <h1 className="mt-1 text-2xl font-semibold">Documents</h1>
          </div>
          <button
            type="button"
            onClick={() => void handleCreateDocument()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#173f35] px-4 text-sm font-semibold text-white hover:bg-[#0f2d26]"
          >
            <Plus className="h-4 w-4" />
            New document
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-5">
        <div className="mb-5 grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#68766a]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or owner"
              className="h-10 w-full rounded-lg border border-[#c8d6cf] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#2457c5] focus:ring-2 focus:ring-[#2457c5]/20"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | 'shared' | 'locked')}
            className="h-10 rounded-lg border border-[#c8d6cf] bg-white px-3 text-sm outline-none focus:border-[#2457c5] focus:ring-2 focus:ring-[#2457c5]/20"
            aria-label="Status filter"
          >
            <option value="all">All statuses</option>
            <option value="shared">Shared only</option>
            <option value="locked">Locked only</option>
          </select>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#c8d6cf] bg-white px-3 text-sm">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
            />
            Include archived
          </label>
        </div>

        {errorMessage ? (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-[#dfb86a] bg-[#fff8e8] px-3 py-2 text-sm text-[#795014]"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="mb-4 flex items-center gap-2 text-sm text-[#526057]">
          <FolderOpen className="h-4 w-4" />
          {`${totalCount} accessible documents`}
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <DocumentSection
            title="Owned"
            documents={dashboard.owned}
            onOpen={handleOpenDocument}
            onRename={handleRenameDocument}
            onArchive={handleArchiveDocument}
            onDelete={handleDeleteDocument}
          />
          <DocumentSection
            title="Shared with me"
            documents={dashboard.sharedWithMe}
            onOpen={handleOpenDocument}
            onRename={handleRenameDocument}
            onArchive={handleArchiveDocument}
            onDelete={handleDeleteDocument}
          />
          <DocumentSection
            title="Recent"
            documents={dashboard.recent}
            onOpen={handleOpenDocument}
            onRename={handleRenameDocument}
            onArchive={handleArchiveDocument}
            onDelete={handleDeleteDocument}
          />
        </div>
      </div>
    </main>
  );
}
