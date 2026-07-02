import { authenticatedFetch } from '../auth/authenticated-fetch';
import {
  isNativeFileDocument,
  type NativeFileDocument,
  type NativeFileImportMode,
  type NativeFileImportReport,
} from '../types/shared';

const SERVER_URL = import.meta.env?.VITE_BACKEND_URL ?? '';

export interface NativeFileImportResult {
  importedElementCount: number;
  documentClock: string | null;
  roomEpoch?: number;
  report?: NativeFileImportReport;
}

export interface NativeFileExportResult {
  document: NativeFileDocument;
  documentClock: string;
}

export async function importNativeFileToRoom(
  roomId: string,
  document: NativeFileDocument,
  mode: NativeFileImportMode,
): Promise<NativeFileImportResult> {
  const response = await authenticatedFetch(`${SERVER_URL}/api/rooms/${roomId}/import-native`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document, mode }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body: unknown = await response.json();
  if (!isNativeFileImportResult(body)) {
    throw new Error('Native file import response was invalid.');
  }

  return body;
}

export async function exportNativeFileFromRoom(roomId: string): Promise<NativeFileExportResult> {
  const response = await authenticatedFetch(`${SERVER_URL}/api/rooms/${roomId}/export-native`);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body: unknown = await response.json();
  if (!isNativeFileExportResult(body)) {
    throw new Error('Native file export response was invalid.');
  }

  return body;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isErrorResponse(body)) return body.error.message;
  } catch {
    // Fall back to status text below.
  }
  return response.statusText || 'Native file import failed.';
}

function isNativeFileImportResult(value: unknown): value is NativeFileImportResult {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.importedElementCount === 'number' &&
    (typeof result.documentClock === 'string' || result.documentClock === null) &&
    (result.report === undefined || isNativeFileImportReport(result.report))
  );
}

function isNativeFileExportResult(value: unknown): value is NativeFileExportResult {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Record<string, unknown>;
  return isNativeFileDocument(result.document) && typeof result.documentClock === 'string';
}

function isNativeFileImportReport(value: unknown): value is NativeFileImportReport {
  if (typeof value !== 'object' || value === null) return false;
  const report = value as Record<string, unknown>;
  return (
    typeof report.importedCount === 'number' &&
    typeof report.skippedCount === 'number' &&
    Array.isArray(report.skipped) &&
    report.skipped.every(isSkippedObject)
  );
}

function isSkippedObject(value: unknown): value is NativeFileImportReport['skipped'][number] {
  if (typeof value !== 'object' || value === null) return false;
  const skipped = value as Record<string, unknown>;
  return typeof skipped.index === 'number' && typeof skipped.reason === 'string';
}

function isErrorResponse(value: unknown): value is { error: { message: string } } {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as Record<string, unknown>).error;
  if (typeof error !== 'object' || error === null) return false;
  return typeof (error as Record<string, unknown>).message === 'string';
}
