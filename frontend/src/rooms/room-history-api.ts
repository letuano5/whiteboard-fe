import { authenticatedFetch } from '../auth/authenticated-fetch';

export type SnapshotReason = 'interval' | 'restore_safety' | 'import_safety';

export interface RoomSnapshotMetadata {
  id: string;
  documentClock: string;
  roomEpoch: number;
  createdBy: string | null;
  createdAt: string;
  reason: SnapshotReason;
}

export interface RestoreSnapshotResult {
  documentClock: string;
  roomEpoch: number;
  restoredElementCount: number;
}

export async function fetchRoomSnapshots(roomId: string): Promise<RoomSnapshotMetadata[]> {
  const response = await authenticatedFetch(`/api/rooms/${roomId}/snapshots`);
  if (!response.ok) throw new Error(await readErrorMessage(response));

  const body: unknown = await response.json();
  if (!Array.isArray(body) || !body.every(isRoomSnapshotMetadata)) {
    throw new Error('Snapshot list response was invalid.');
  }
  return body;
}

export async function restoreRoomSnapshot(
  roomId: string,
  snapshotId: string,
): Promise<RestoreSnapshotResult> {
  const response = await authenticatedFetch(
    `/api/rooms/${roomId}/snapshots/${snapshotId}/restore`,
    { method: 'POST' },
  );
  if (!response.ok) throw new Error(await readErrorMessage(response));

  const body: unknown = await response.json();
  if (!isRestoreSnapshotResult(body)) {
    throw new Error('Snapshot restore response was invalid.');
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
  return response.statusText || 'Room history request failed.';
}

function isRoomSnapshotMetadata(value: unknown): value is RoomSnapshotMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const snapshot = value as Record<string, unknown>;
  return (
    typeof snapshot.id === 'string' &&
    typeof snapshot.documentClock === 'string' &&
    typeof snapshot.roomEpoch === 'number' &&
    (typeof snapshot.createdBy === 'string' || snapshot.createdBy === null) &&
    typeof snapshot.createdAt === 'string' &&
    isSnapshotReason(snapshot.reason)
  );
}

function isRestoreSnapshotResult(value: unknown): value is RestoreSnapshotResult {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.documentClock === 'string' &&
    typeof result.roomEpoch === 'number' &&
    typeof result.restoredElementCount === 'number'
  );
}

function isSnapshotReason(value: unknown): value is SnapshotReason {
  return value === 'interval' || value === 'restore_safety' || value === 'import_safety';
}

function isErrorResponse(value: unknown): value is { error: { message: string } } {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as Record<string, unknown>).error;
  if (typeof error !== 'object' || error === null) return false;
  return typeof (error as Record<string, unknown>).message === 'string';
}
