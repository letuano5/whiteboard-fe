import type { ReactNode } from 'react';
import { Archive, Clock3, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import type { DashboardDocument } from './document-api';
import { DocumentPreview } from './DocumentPreview';

interface DocumentCardProps {
  document: DashboardDocument;
  onOpen(roomId: string): Promise<void>;
  onRename(document: DashboardDocument): Promise<void>;
  onArchive(document: DashboardDocument): Promise<void>;
  onDelete(document: DashboardDocument): Promise<void>;
}

export function DocumentCard({
  document,
  onOpen,
  onRename,
  onArchive,
  onDelete,
}: DocumentCardProps) {
  return (
    <article className="group min-w-0">
      <button
        type="button"
        onClick={() => void onOpen(document.id)}
        className="block w-full rounded-lg bg-[#f3f5f6] p-3 text-left transition-colors hover:bg-[#e9edef] focus:outline-none focus:ring-2 focus:ring-[#2457c5] focus:ring-offset-2"
        aria-label={`Open ${document.name}`}
      >
        <DocumentPreview elements={document.previewElements} title={document.name} />
      </button>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-[#202124]">{document.name}</h2>
          <p className="mt-1 truncate text-sm text-[#6b6f76]">
            {document.ownerName ?? 'Unknown owner'} · {document.role}
          </p>
          <p className="mt-1 flex items-center gap-1 text-sm text-[#6b6f76]">
            <Clock3 className="h-3.5 w-3.5" />
            {formatRecentTime(document.lastOpenedAt ?? document.updatedAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <IconButton label={`Open ${document.name}`} onClick={() => void onOpen(document.id)}>
            <FolderOpen className="h-4 w-4" />
          </IconButton>
          <IconButton label={`Rename ${document.name}`} onClick={() => void onRename(document)}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton
            label={document.archivedAt ? `Restore ${document.name}` : `Archive ${document.name}`}
            onClick={() => void onArchive(document)}
          >
            <Archive className="h-4 w-4" />
          </IconButton>
          <IconButton
            label={`Delete ${document.name}`}
            tone="danger"
            onClick={() => void onDelete(document)}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </article>
  );
}

function IconButton({
  children,
  label,
  tone = 'default',
  onClick,
}: {
  children: ReactNode;
  label: string;
  tone?: 'default' | 'danger';
  onClick(): void;
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-[#e2c1a5] text-[#8a3b12] hover:bg-[#fff4ec]'
      : 'border-[#d7dce1] text-[#3d444d] hover:bg-[#eef2f4]';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border bg-white ${toneClass}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function formatRecentTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently updated';
  return `Updated ${date.toLocaleDateString()}`;
}
