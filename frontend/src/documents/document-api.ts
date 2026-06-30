import { authenticatedFetch } from '../auth/authenticated-fetch';

const SERVER_URL = import.meta.env?.VITE_BACKEND_URL ?? '';

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
}

export interface DocumentDashboardResponse {
  owned: DashboardDocument[];
  sharedWithMe: DashboardDocument[];
  recent: DashboardDocument[];
}

export interface ListDocumentsInput {
  search?: string;
  includeArchived?: boolean;
  status?: 'all' | 'shared' | 'locked';
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

  if (input.includeArchived) {
    params.set('includeArchived', 'true');
  }

  if (input.status && input.status !== 'all') {
    params.set('status', input.status);
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

async function readErrorMessage(response: Response): Promise<string> {
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

function isDocumentDashboardResponse(value: unknown): value is DocumentDashboardResponse {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.owned) &&
    record.owned.every(isDashboardDocument) &&
    Array.isArray(record.sharedWithMe) &&
    record.sharedWithMe.every(isDashboardDocument) &&
    Array.isArray(record.recent) &&
    record.recent.every(isDashboardDocument)
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
    (typeof document.lastOpenedAt === 'string' || document.lastOpenedAt === null)
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
