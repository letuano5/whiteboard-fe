import { useRef, useState, type ChangeEvent } from 'react';
import { AlertCircle, Download, Loader2, Upload, X } from 'lucide-react';
import type { Element, NativeFileDocument } from '../types/shared';
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
      await importNativeFileToRoom(roomId, document, 'merge');
      mergeImportedElements(document.elements);
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

  function mergeImportedElements(imported: Element[]) {
    const byId = new Map(
      useElementsStore.getState().elements.map((element) => [element.id, element]),
    );
    imported.forEach((element) => byId.set(element.id, element));
    useElementsStore.getState().setElements([...byId.values()]);
  }

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={isExporting}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#cbd9cb] bg-white text-[#173f35] shadow-[0_8px_24px_rgba(23,63,53,0.12)] hover:bg-[#edf5ef] focus:outline-none focus:ring-2 focus:ring-[#2457c5] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#cbd9cb] bg-white text-[#173f35] shadow-[0_8px_24px_rgba(23,63,53,0.12)] hover:bg-[#edf5ef] focus:outline-none focus:ring-2 focus:ring-[#2457c5] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="absolute right-0 top-12 z-[90] w-[min(340px,calc(100vw-24px))] rounded-lg border border-[#b7c7b7] bg-[#fbfdf9] p-4 text-[#18231d] shadow-[0_20px_60px_rgba(28,41,33,0.18)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-[#68766a]">Native file</p>
              <h2 className="mt-1 text-lg font-semibold">Confirm import</h2>
            </div>
            <button
              type="button"
              onClick={() => setPendingDocument(null)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#cbd9cb] bg-white text-[#314039] hover:bg-[#edf5ef]"
              aria-label="Cancel import"
              disabled={isImporting}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm leading-6 text-[#4c5d52]">
            {mode === 'local'
              ? 'Replace the current local board with this file?'
              : 'Merge this file into the current saved document?'}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPendingDocument(null)}
              disabled={isImporting}
              className="flex h-10 items-center justify-center rounded-lg border border-[#173f35] bg-white px-3 text-sm font-semibold text-[#173f35] hover:bg-[#edf5ef] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void applyDocument(pendingDocument)}
              disabled={isImporting}
              className="flex h-10 items-center justify-center rounded-lg bg-[#173f35] px-3 text-sm font-semibold text-white hover:bg-[#0f2d26] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Import
            </button>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="absolute right-0 top-12 z-[90] flex w-[min(340px,calc(100vw-24px))] gap-2 rounded-lg border border-[#dfb86a] bg-[#fff8e8] px-3 py-2 text-sm text-[#795014] shadow-[0_16px_44px_rgba(28,41,33,0.14)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
