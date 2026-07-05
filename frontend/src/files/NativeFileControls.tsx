import { useRef, useState, type ChangeEvent } from 'react';
import { AlertCircle, Download, Loader2, Upload, X } from 'lucide-react';
import type { NativeFileDocument } from '../types/shared';
import { useCameraStore } from '../store/camera.store';
import { useElementsStore } from '../store/elements.store';
import { writeLocalScene } from '../sync/local-storage';
import {
  buildNativeFileDocument,
  createNativeFileName,
  downloadNativeFile,
  parseNativeFileText,
} from './native-file';
import { exportNativeFileFromRoom, importNativeFileToRoom } from './file-lifecycle-api';

interface NativeFileControlsProps {
  mode: 'local' | 'saved';
  roomId: string | null;
  canImport: boolean;
}

export function NativeFileControls({ mode, roomId, canImport }: NativeFileControlsProps) {
  const elements = useElementsStore((state) => state.elements);
  const camera = useCameraStore((state) => state.camera);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDocument, setPendingDocument] = useState<NativeFileDocument | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  async function handleExport() {
    setErrorMessage(null);
    if (mode === 'saved') {
      if (!roomId) {
        setErrorMessage('Saved document room is missing.');
        return;
      }
      setIsExporting(true);
      try {
        const result = await exportNativeFileFromRoom(roomId);
        downloadNativeFile(
          result.document,
          createNativeFileName(result.document.room.name, result.document.room.source),
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Could not export native file.');
      } finally {
        setIsExporting(false);
      }
      return;
    }

    const document = buildNativeFileDocument({
      elements,
      camera,
      room: {
        id: roomId,
        name: null,
        source: mode,
      },
    });
    downloadNativeFile(document, createNativeFileName(document.room.name, mode));
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setErrorMessage(null);
    try {
      const document = parseNativeFileText(await file.text());
      if (elements.some((element) => !element.isDeleted)) {
        setPendingDocument(document);
        return;
      }
      await applyDocument(document);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load native file.');
    }
  }

  async function applyDocument(document: NativeFileDocument) {
    if (mode === 'local') {
      replaceLocalDocument(document);
      setPendingDocument(null);
      return;
    }

    if (!roomId) {
      setErrorMessage('Saved document room is missing.');
      setPendingDocument(null);
      return;
    }

    setIsImporting(true);
    try {
      await importNativeFileToRoom(roomId, document, 'replace');
      useCameraStore.getState().setCamera(document.camera);
      setPendingDocument(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not import native file.');
    } finally {
      setIsImporting(false);
    }
  }

  function replaceLocalDocument(document: NativeFileDocument) {
    useElementsStore.getState().setElements(document.elements);
    useCameraStore.getState().setCamera(document.camera);
    writeLocalScene({ elements: document.elements, camera: document.camera });
  }

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={isExporting}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-rule bg-paper text-ink shadow-md hover:bg-panel focus:outline-none focus:ring-2 focus:ring-primary-soft focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Export native file"
        title="Export native file"
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={!canImport || isImporting}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-rule bg-paper text-ink shadow-md hover:bg-panel focus:outline-none focus:ring-2 focus:ring-primary-soft focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Import native file"
        title="Import native file"
      >
        {isImporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".vdt.json,application/json"
        className="hidden"
        onChange={(event) => void handleFileSelected(event)}
      />

      {pendingDocument ? (
        <div className="absolute right-0 top-12 z-[90] w-[min(340px,calc(100vw-24px))] rounded-lg border border-rule bg-paper p-4 text-ink shadow-lg">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Native file</p>
              <h2 className="mt-1 text-lg font-semibold">Confirm import</h2>
            </div>
            <button
              type="button"
              onClick={() => setPendingDocument(null)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rule bg-paper text-ink hover:bg-panel"
              aria-label="Cancel import"
              disabled={isImporting}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm leading-6 text-muted">
            {mode === 'local'
              ? 'Replace the current local board with this file?'
              : 'Replace the current saved document with this file?'}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPendingDocument(null)}
              disabled={isImporting}
              className="flex h-10 items-center justify-center rounded-lg border border-ink bg-paper px-3 text-sm font-semibold text-ink hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void applyDocument(pendingDocument)}
              disabled={isImporting}
              className="flex h-10 items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-paper hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Import
            </button>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="absolute right-0 top-12 z-[90] flex w-[min(340px,calc(100vw-24px))] gap-2 rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning shadow-lg"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
