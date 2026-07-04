import type { Element } from '@vdt/shared';
import type { SyncRoomPersistenceCommit } from '../sync/sync-room-contracts.js';

export const SNAPSHOT_INTERVAL_MS = 30_000;

export type SnapshotReason = 'interval' | 'restore_safety' | 'import_safety';

export interface SnapshotMetadata {
  id: string;
  documentClock: string;
  roomEpoch: number;
  createdBy: string | null;
  createdAt: string;
  reason: SnapshotReason;
}

export interface SnapshotTombstone {
  recordId: string;
  deletedClock: string;
}

export interface SnapshotRecord {
  id: string;
  roomId: string;
  documentClock: bigint;
  roomEpoch: bigint;
  createdBy: string | null;
  createdAt: Date;
  reason: string;
  records: unknown;
  tombstones: unknown;
}

export interface SnapshotSourceState {
  documentClock: number;
  roomEpoch: number;
  elements: Element[];
  tombstones: SnapshotTombstone[];
}

export interface RoomSnapshotDb {
  room: {
    findUnique: (args: {
      where: { id: string };
      select: {
        documentClock: true;
        roomEpoch: true;
        records: { select: { state: true } };
        tombstones: { select: { recordId: true; deletedClock: true } };
      };
    }) => Promise<{
      documentClock: bigint;
      roomEpoch: bigint;
      records: Array<{ state: unknown }>;
      tombstones: Array<{ recordId: string; deletedClock: bigint }>;
    } | null>;
  };
  snapshot: {
    create: (args: {
      data: {
        roomId: string;
        documentClock: bigint;
        roomEpoch: bigint;
        createdBy: string | null;
        reason: SnapshotReason;
        records: unknown;
        tombstones: unknown;
      };
      select?: { id: true };
    }) => Promise<{ id: string } | unknown>;
    findFirst: (args: {
      where: { roomId: string };
      orderBy: { createdAt: 'desc' } | { documentClock: 'desc' };
      select: { createdAt: true; documentClock: true };
    }) => Promise<{ createdAt: Date; documentClock: bigint } | null>;
  };
}

export async function captureRoomSnapshot(
  db: RoomSnapshotDb,
  input: {
    roomId: string;
    reason: SnapshotReason;
    createdBy: string | null;
    sourceState?: SnapshotSourceState;
  },
): Promise<{ id: string } | null> {
  const state = input.sourceState ?? (await loadSnapshotSourceState(db, input.roomId));
  if (!state) return null;

  const created = await db.snapshot.create({
    data: {
      roomId: input.roomId,
      documentClock: BigInt(state.documentClock),
      roomEpoch: BigInt(state.roomEpoch),
      createdBy: input.createdBy,
      reason: input.reason,
      records: state.elements,
      tombstones: state.tombstones,
    },
    select: { id: true },
  });

  return isSnapshotIdResult(created) ? created : null;
}

export async function captureIntervalSnapshotForCommit(
  db: RoomSnapshotDb,
  commit: SyncRoomPersistenceCommit,
  options: { now?: Date } = {},
): Promise<{ id: string } | null> {
  if (!hasSnapshotDelegate(db)) return null;

  const changeSet = commit.result.changeSet;
  const now = options.now ?? new Date();
  const latest = await db.snapshot.findFirst({
    where: { roomId: changeSet.roomId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, documentClock: true },
  });

  if (latest) {
    const elapsedMs = now.getTime() - latest.createdAt.getTime();
    if (elapsedMs < SNAPSHOT_INTERVAL_MS) return null;
    if (changeSet.serverClock <= Number(latest.documentClock)) return null;
  }

  return captureRoomSnapshot(db, {
    roomId: changeSet.roomId,
    reason: 'interval',
    createdBy: commit.actorId,
    sourceState: undefined,
  });
}

export async function loadSnapshotSourceState(
  db: RoomSnapshotDb,
  roomId: string,
): Promise<SnapshotSourceState | null> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: {
      documentClock: true,
      roomEpoch: true,
      records: { select: { state: true } },
      tombstones: { select: { recordId: true, deletedClock: true } },
    },
  });

  if (!room) return null;

  return {
    documentClock: Number(room.documentClock),
    roomEpoch: Number(room.roomEpoch),
    elements: room.records.map((record) => record.state as Element),
    tombstones: room.tombstones.map((tombstone) => ({
      recordId: tombstone.recordId,
      deletedClock: tombstone.deletedClock.toString(),
    })),
  };
}

export function toSnapshotMetadata(record: SnapshotRecord): SnapshotMetadata {
  return {
    id: record.id,
    documentClock: record.documentClock.toString(),
    roomEpoch: Number(record.roomEpoch),
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    reason: toSnapshotReason(record.reason),
  };
}

export function readSnapshotElements(value: unknown): Element[] {
  return Array.isArray(value) ? (value as Element[]) : [];
}

function toSnapshotReason(reason: string): SnapshotReason {
  if (reason === 'restore_safety' || reason === 'import_safety') return reason;
  return 'interval';
}

function isSnapshotIdResult(value: unknown): value is { id: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string'
  );
}

function hasSnapshotDelegate(value: RoomSnapshotDb): boolean {
  const candidate = value as Partial<RoomSnapshotDb>;
  return (
    typeof candidate.snapshot?.findFirst === 'function' &&
    typeof candidate.snapshot.create === 'function'
  );
}
