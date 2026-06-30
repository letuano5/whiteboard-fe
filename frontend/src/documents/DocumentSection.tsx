import { Archive, Clock3, FolderOpen, Trash2 } from 'lucide-react';
import type { DashboardDocument } from './document-api';

interface DocumentSectionProps {
  title: string;
  documents: DashboardDocument[];
  onOpen(roomId: string): Promise<void>;
  onRename(document: DashboardDocument): Promise<void>;
  onArchive(document: DashboardDocument): Promise<void>;
  onDelete(document: DashboardDocument): Promise<void>;
}

export function DocumentSection({
  title,
  documents,
  onOpen,
  onRename,
  onArchive,
  onDelete,
}: DocumentSectionProps) {
  return (
    <section className="min-w-0">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase text-[#526057]">{title}</h2>
        <span className="text-xs text-[#68766a]">{documents.length}</span>
      </div>
      <div className="space-y-2">
        {documents.length ? (
          documents.map((document) => (
            <article
              key={`${title}-${document.id}`}
              className="rounded-lg border border-[#d7e0da] bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{document.name}</h3>
                  <p className="mt-1 truncate text-xs text-[#68766a]">
                    {document.ownerName ?? 'Unknown owner'} - {document.role}
                    {document.locked ? ' - locked' : ''}
                    {document.archivedAt ? ' - archived' : ''}
                  </p>
                  <p className="mt-2 flex items-center gap-1 text-xs text-[#68766a]">
                    <Clock3 className="h-3.5 w-3.5" />
                    Updated {new Date(document.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onOpen(document.id)}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-[#173f35] px-3 text-xs font-semibold text-white hover:bg-[#0f2d26]"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Open
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => void onRename(document)}
                  className="h-8 rounded-lg border border-[#c8d6cf] bg-white text-xs font-semibold text-[#314039] hover:bg-[#edf5ef]"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => void onArchive(document)}
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-[#c8d6cf] bg-white text-xs font-semibold text-[#314039] hover:bg-[#edf5ef]"
                >
                  <Archive className="h-3.5 w-3.5" />
                  {document.archivedAt ? 'Restore' : 'Archive'}
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(document)}
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-[#dfb86a] bg-white text-xs font-semibold text-[#795014] hover:bg-[#fff8e8]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-[#c8d6cf] bg-white px-3 py-5 text-sm text-[#68766a]">
            No documents.
          </p>
        )}
      </div>
    </section>
  );
}
