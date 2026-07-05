import { useState } from 'react';
import { AlertCircle, History, Loader2, RotateCcw, X } from 'lucide-react';
import {
  fetchRoomSnapshots,
  restoreRoomSnapshot,
  type RoomSnapshotMetadata,
  type SnapshotReason,
} from './room-history-api';

interface RoomHistoryButtonProps {
  roomId: string | null;
  canRestore: boolean;
}

export function RoomHistoryButton({ roomId, canRestore }: RoomHistoryButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<RoomSnapshotMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadSnapshots(nextRoomId: string) {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setSnapshots(await fetchRoomSnapshots(nextRoomId));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load snapshots.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleToggle() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    if (!roomId) return;
    setIsOpen(true);
    void loadSnapshots(roomId);
  }

  async function handleRestore(snapshot: RoomSnapshotMetadata) {
    if (!roomId) return;
    const confirmed = window.confirm(
      'Restore this snapshot? Current document state will be replaced.',
    );
    if (!confirmed) return;

    setRestoringId(snapshot.id);
    setErrorMessage(null);
    try {
      await restoreRoomSnapshot(roomId, snapshot.id);
      setIsOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not restore snapshot.');
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        disabled={!roomId}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-rule bg-paper text-ink shadow-md hover:bg-panel focus:outline-none focus:ring-2 focus:ring-primary-soft focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Open version history"
        title="Version history"
      >
        <History className="h-4 w-4" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-12 z-[90] w-[min(380px,calc(100vw-24px))] rounded-lg border border-rule bg-paper p-4 text-ink shadow-lg">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Versions</p>
              <h2 className="mt-1 text-lg font-semibold">Snapshot history</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rule bg-paper text-ink hover:bg-panel"
              aria-label="Close version history"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="mb-3 flex gap-2 rounded-md border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {errorMessage}
            </p>
          ) : null}

          {isLoading ? (
            <div className="flex h-20 items-center justify-center text-muted">
              <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading snapshots" />
            </div>
          ) : (
            <ol className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {snapshots.length === 0 ? (
                <li className="rounded-md border border-dashed border-rule px-3 py-4 text-sm text-muted">
                  No snapshots yet.
                </li>
              ) : (
                snapshots.map((snapshot) => (
                  <li
                    key={snapshot.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-rule bg-paper px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {formatSnapshotTime(snapshot.createdAt)}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {reasonLabel(snapshot.reason)} · clock {snapshot.documentClock} · epoch{' '}
                        {snapshot.roomEpoch}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted">
                        {snapshot.createdBy ?? 'system'}
                      </p>
                    </div>
                    {canRestore ? (
                      <button
                        type="button"
                        onClick={() => void handleRestore(snapshot)}
                        disabled={restoringId !== null}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink bg-paper text-ink hover:bg-panel focus:outline-none focus:ring-2 focus:ring-primary-soft focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={`Restore snapshot from ${formatSnapshotTime(snapshot.createdAt)}`}
                        title="Restore snapshot"
                      >
                        {restoringId === snapshot.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </li>
                ))
              )}
            </ol>
          )}
        </div>
      ) : null}
    </div>
  );
}

function reasonLabel(reason: SnapshotReason): string {
  if (reason === 'restore_safety') return 'restore safety';
  if (reason === 'import_safety') return 'import safety';
  return 'interval';
}

function formatSnapshotTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
