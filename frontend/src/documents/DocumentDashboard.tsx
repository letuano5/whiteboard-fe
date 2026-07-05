import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, FolderOpen, Loader2, Plus, Search } from 'lucide-react';
import { AuthMenu } from '../auth/AuthMenu';
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
  type DocumentScopeFilter,
} from './document-api';
import { DocumentCard } from './DocumentCard';
import { DocumentDashboardLogin } from './DocumentDashboardLogin';
import { homePath, roomPath } from '../app/routing';

const EMPTY_DASHBOARD: DocumentDashboardResponse = {
  documents: [],
  nextCursor: null,
};

const PAGE_LIMIT = 10;

const SCOPE_OPTIONS: { value: DocumentScopeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'owned', label: 'Owned by me' },
  { value: 'shared', label: 'Shared with me' },
];

export function DocumentDashboard() {
  const session = useAuthStore((state: AuthStoreState) => state.session);
  const status = useAuthStore((state: AuthStoreState) => state.status);
  const initAuth = useAuthStore((state: AuthStoreState) => state.initAuth);
  const [documents, setDocuments] = useState<DashboardDocument[]>(EMPTY_DASHBOARD.documents);
  const [nextCursor, setNextCursor] = useState<string | null>(EMPTY_DASHBOARD.nextCursor);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<DocumentScopeFilter>('all');
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const latestRequestRef = useRef(0);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'idle') {
      void initAuth();
    }
  }, [initAuth, status]);

  const fetchDocuments = useCallback(
    async (mode: 'replace' | 'append', cursor: string | null = null) => {
      const requestId =
        mode === 'replace' ? latestRequestRef.current + 1 : latestRequestRef.current;
      latestRequestRef.current = requestId;
      setErrorMessage(null);
      if (mode === 'replace') {
        setIsInitialLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const result = await listDocuments({ search, scope, cursor, limit: PAGE_LIMIT });
        if (requestId !== latestRequestRef.current) return;

        setNextCursor(result.nextCursor);
        setDocuments((current) =>
          mode === 'replace' ? result.documents : mergeDocuments(current, result.documents),
        );
      } catch (error) {
        if (requestId === latestRequestRef.current) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not load documents.');
        }
      } finally {
        if (requestId === latestRequestRef.current) {
          setIsInitialLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [scope, search],
  );

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => {
      void fetchDocuments('replace');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchDocuments, session]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !nextCursor || isInitialLoading || isLoadingMore) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchDocuments('append', nextCursor);
        }
      },
      { rootMargin: '420px' },
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [fetchDocuments, isInitialLoading, isLoadingMore, nextCursor]);

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
      await fetchDocuments('replace');
    });
  }

  async function handleArchiveDocument(document: DashboardDocument) {
    await runAction(async () => {
      await archiveDocument(document.id, !document.archivedAt);
      await fetchDocuments('replace');
    });
  }

  async function handleDeleteDocument(document: DashboardDocument) {
    if (!window.confirm(`Delete ${document.name}?`)) return;
    await runAction(async () => {
      await deleteDocument(document.id);
      await fetchDocuments('replace');
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
    window.history.pushState({}, '', roomPath(roomId));
    window.location.reload();
  }

  function handleOpenLocalBoard() {
    window.history.pushState({}, '', homePath());
    window.location.reload();
  }

  const isCheckingAuth = status === 'idle' || status === 'loading';

  if (!session) {
    return <DocumentDashboardLogin isCheckingAuth={isCheckingAuth} />;
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-8 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Workspace</p>
              <h1 className="mt-1 text-2xl font-semibold text-ink">Recent documents</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleOpenLocalBoard}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ink bg-paper px-4 text-sm font-semibold text-ink hover:bg-panel"
              >
                <FileText className="h-4 w-4" />
                Open local board
              </button>
              <button
                type="button"
                onClick={() => void handleCreateDocument()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-paper hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                New document
              </button>
              <AuthMenu />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(260px,520px)_auto] md:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or owner"
                className="h-10 w-full rounded-lg border border-field-border bg-paper pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
              />
            </label>
            <div className="flex flex-wrap gap-2" aria-label="Document ownership filter">
              {SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setScope(option.value)}
                  className={`h-10 rounded-lg border px-4 text-sm font-semibold ${
                    scope === option.value
                      ? 'border-primary bg-primary text-paper'
                      : 'border-field-border bg-paper text-muted hover:bg-panel'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1680px] px-8 py-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-muted">
          <FolderOpen className="h-4 w-4" />
          {documents.length} loaded · sorted by recent activity
        </div>

        {errorMessage ? (
          <p
            role="alert"
            className="mb-5 rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning"
          >
            {errorMessage}
          </p>
        ) : null}

        {isInitialLoading ? (
          <div className="grid min-h-[280px] place-items-center text-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : documents.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-7 gap-y-10">
            {documents.map((document) => (
              <DocumentCard
                key={document.id}
                document={document}
                onOpen={handleOpenDocument}
                onRename={handleRenameDocument}
                onArchive={handleArchiveDocument}
                onDelete={handleDeleteDocument}
              />
            ))}
          </div>
        ) : (
          <div className="grid min-h-[280px] place-items-center rounded-lg border border-dashed border-rule bg-panel px-4 text-center">
            <div>
              <FolderOpen className="mx-auto h-8 w-8 text-muted" />
              <p className="mt-3 text-sm font-semibold text-ink">No documents found</p>
              <p className="mt-1 text-sm text-muted">Try a different search or filter.</p>
            </div>
          </div>
        )}

        <div ref={loadMoreRef} className="h-10" />
        {isLoadingMore ? (
          <div className="flex justify-center py-6 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : nextCursor ? (
          <div className="flex justify-center py-6">
            <button
              type="button"
              onClick={() => void fetchDocuments('append', nextCursor)}
              className="h-10 rounded-lg border border-field-border bg-paper px-4 text-sm font-semibold text-muted hover:bg-panel"
            >
              Load more
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function mergeDocuments(
  current: DashboardDocument[],
  incoming: DashboardDocument[],
): DashboardDocument[] {
  const byId = new Map(current.map((document) => [document.id, document]));
  incoming.forEach((document) => byId.set(document.id, document));
  return [...byId.values()];
}
