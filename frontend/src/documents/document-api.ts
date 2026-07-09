import { authenticatedFetch } from '../auth/authenticated-fetch';
import { useAuthStore } from '../auth/auth.store';
import type { Element } from '../types/shared';

const SERVER_URL = import.meta.env?.VITE_BACKEND_URL ?? '';

export type DocumentScopeFilter = 'all' | 'owned' | 'shared';

export interface DashboardDocument {
  id: string;
  name: string;
  ownerId: string | null;
  ownerName: string | null;
  role: string;
  visibility: string;
  locked: boolean;
  archivedAt: string | null;
  updatedAt: string;
  lastOpenedAt: string | null;
  previewElements: Element[];
}

export interface DocumentDashboardResponse {
  documents: DashboardDocument[];
  nextCursor: string | null;
}

export interface ListDocumentsInput {
  search?: string;
  scope?: DocumentScopeFilter;
  cursor?: string | null;
  limit?: number;
}

export async function listDocuments(
  input: ListDocumentsInput = {},
): Promise<DocumentDashboardResponse> {
  const response = await authenticatedFetch(`${SERVER_URL}/api/documents${buildQuery(input)}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body: unknown = await response.json();
  if (!isDocumentDashboardResponse(body)) {
    throw new Error('Document dashboard response was invalid.');
  }

  return body;
}

export async function createDocument(name?: string): Promise<{ roomId: string }> {
  const response = await authenticatedFetch(`${SERVER_URL}/api/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(name ? { name } : {}),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body: unknown = await response.json();
  if (!isRoomIdResponse(body)) {
    throw new Error('Create document response was invalid.');
  }

  return body;
}

export async function openDocument(roomId: string): Promise<void> {
  const response = await authenticatedFetch(`${SERVER_URL}/api/documents/${roomId}/open`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export async function renameDocument(roomId: string, name: string): Promise<DashboardDocument> {
  return updateDocument(roomId, { name });
}

export async function archiveDocument(
  roomId: string,
  archived: boolean,
): Promise<DashboardDocument> {
  return updateDocument(roomId, { archived });
}

export async function deleteDocument(roomId: string): Promise<void> {
  const response = await authenticatedFetch(`${SERVER_URL}/api/documents/${roomId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

async function updateDocument(
  roomId: string,
  body: { name?: string; archived?: boolean },
): Promise<DashboardDocument> {
  const response = await authenticatedFetch(`${SERVER_URL}/api/documents/${roomId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const value: unknown = await response.json();
  if (!isDashboardDocument(value)) {
    throw new Error('Update document response was invalid.');
  }

  return value;
}

function buildQuery(input: ListDocumentsInput): string {
  const params = new URLSearchParams();

  if (input.search?.trim()) {
    params.set('search', input.search.trim());
  }

  if (input.scope && input.scope !== 'all') {
    params.set('scope', input.scope);
  }

  if (input.cursor) {
    params.set('cursor', input.cursor);
  }

  if (input.limit !== undefined) {
    params.set('limit', String(input.limit));
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

async function readErrorMessage(response: Response): Promise<string> {
  if (isDocumentAuthFailure(response)) {
    clearAuthSession();
  }

  try {
    const body: unknown = await response.json();
    if (isErrorResponse(body)) {
      return body.error.message;
    }
  } catch {
    // Fall back to status text below.
  }

  return response.statusText || 'Document request failed.';
}

function isDocumentAuthFailure(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}

function clearAuthSession(): void {
  useAuthStore.setState({
    session: null,
    status: 'anonymous',
    errorMessage: null,
    noticeMessage: null,
  });
}

function isDocumentDashboardResponse(value: unknown): value is DocumentDashboardResponse {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.documents) &&
    record.documents.every(isDashboardDocument) &&
    (typeof record.nextCursor === 'string' || record.nextCursor === null)
  );
}

function isDashboardDocument(value: unknown): value is DashboardDocument {
  if (typeof value !== 'object' || value === null) return false;
  const document = value as Record<string, unknown>;
  return (
    typeof document.id === 'string' &&
    typeof document.name === 'string' &&
    (typeof document.ownerId === 'string' || document.ownerId === null) &&
    (typeof document.ownerName === 'string' || document.ownerName === null) &&
    typeof document.role === 'string' &&
    typeof document.visibility === 'string' &&
    typeof document.locked === 'boolean' &&
    (typeof document.archivedAt === 'string' || document.archivedAt === null) &&
    typeof document.updatedAt === 'string' &&
    (typeof document.lastOpenedAt === 'string' || document.lastOpenedAt === null) &&
    Array.isArray(document.previewElements)
  );
}

function isRoomIdResponse(value: unknown): value is { roomId: string } {
  if (typeof value !== 'object' || value === null) return false;
  return typeof (value as Record<string, unknown>).roomId === 'string';
}

function isErrorResponse(value: unknown): value is { error: { message: string } } {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as Record<string, unknown>).error;
  if (typeof error !== 'object' || error === null) return false;
  return typeof (error as Record<string, unknown>).message === 'string';
}
