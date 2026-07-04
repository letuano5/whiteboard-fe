import {
  NATIVE_FILE_KIND,
  NATIVE_FILE_SCHEMA_VERSION,
  normalizeNativeFileDocument,
  type Camera,
  type Element,
  type NativeFileAssetMetadata,
  type NativeFileDocument,
  type NativeFileImportReport,
  type NativeFileRoomMetadata,
} from '../types/shared';

export class NativeFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NativeFileError';
  }
}

export interface BuildNativeFileInput {
  elements: Element[];
  camera: Camera;
  room: Omit<NativeFileRoomMetadata, 'exportedAt'> & { exportedAt?: string };
  assets?: NativeFileAssetMetadata[];
}

export function buildNativeFileDocument(input: BuildNativeFileInput): NativeFileDocument {
  return {
    kind: NATIVE_FILE_KIND,
    schemaVersion: NATIVE_FILE_SCHEMA_VERSION,
    room: {
      ...input.room,
      exportedAt: input.room.exportedAt ?? new Date().toISOString(),
    },
    camera: input.camera,
    elements: input.elements,
    assets: input.assets ?? [],
  };
}

export function serializeNativeFile(document: NativeFileDocument): string {
  return JSON.stringify(document, null, 2);
}

export function parseNativeFileText(text: string): NativeFileDocument {
  return parseNativeFileTextWithReport(text).document;
}

export function parseNativeFileTextWithReport(text: string): {
  document: NativeFileDocument;
  report: NativeFileImportReport;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new NativeFileError('File is not valid JSON.');
  }

  const normalized = normalizeNativeFileDocument(parsed);
  if (!normalized.ok) {
    throw new NativeFileError(normalized.error);
  }

  return { document: normalized.document, report: normalized.report };
}

export function createNativeFileName(roomName: string | null, source: 'local' | 'saved'): string {
  const baseName = roomName?.trim() || (source === 'local' ? 'local-board' : 'whiteboard');
  const safeName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${safeName || 'whiteboard'}.vdt.json`;
}

export function downloadNativeFile(document: NativeFileDocument, filename: string): void {
  const blob = new Blob([serializeNativeFile(document)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
