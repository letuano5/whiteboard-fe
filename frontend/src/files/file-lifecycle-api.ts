import { authenticatedFetch } from '../auth/authenticated-fetch';
import type { NativeFileDocument, NativeFileImportMode } from '../types/shared';

const SERVER_URL = import.meta.env?.VITE_BACKEND_URL ?? '';

export interface NativeFileImportResult {
  importedElementCount: number;
  documentClock: string | null;
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
    (typeof result.documentClock === 'string' || result.documentClock === null)
  );
}

function isErrorResponse(value: unknown): value is { error: { message: string } } {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as Record<string, unknown>).error;
  if (typeof error !== 'object' || error === null) return false;
  return typeof (error as Record<string, unknown>).message === 'string';
}
