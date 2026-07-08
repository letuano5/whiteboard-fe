import type { SyncCommand } from '../../types/shared';
import type { QueuedSyncCommand } from './state';

const DB_NAME = 'vdt-whiteboard-sync-outbox';
const DB_VERSION = 1;
const STORE_NAME = 'commands';
const ROOM_INDEX = 'roomId';
const CREATED_AT_INDEX = 'createdAt';

export const DURABLE_OUTBOX_MAX_COMMANDS_PER_ROOM = 64;
export const DURABLE_OUTBOX_SOFT_TOTAL_BYTES = 10 * 1024 * 1024;
export const DURABLE_OUTBOX_SOFT_COMMAND_BYTES = 256 * 1024;
export const DURABLE_OUTBOX_HARD_COMMAND_BYTES = 1024 * 1024;
export const DURABLE_OUTBOX_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface DurableOutboxRecord extends QueuedSyncCommand {
  roomId: string;
  requestId: string;
  baseRoomEpoch: number;
  clientClock: number;
  byteSize: number;
}

let openDbPromise: Promise<IDBDatabase | null> | null = null;
const memoryFallback = new Map<string, DurableOutboxRecord>();

export function shouldPersistDurableCommand(command: SyncCommand): boolean {
  return (
    command.kind !== 'replace-document' &&
    command.persistence?.transient !== true &&
    command.persistence?.resendable !== false
  );
}

export async function persistDurableCommand(queued: QueuedSyncCommand): Promise<void> {
  if (!shouldPersistDurableCommand(queued.command)) return;

  const record = toDurableRecord(queued);
  if (record.byteSize > DURABLE_OUTBOX_HARD_COMMAND_BYTES) {
    console.warn(
      `[sync-outbox] command ${record.requestId} is too large to persist (${record.byteSize} bytes).`,
    );
    return;
  }
  if (record.byteSize > DURABLE_OUTBOX_SOFT_COMMAND_BYTES) {
    console.warn(
      `[sync-outbox] command ${record.requestId} exceeds soft size cap (${record.byteSize} bytes).`,
    );
  }

  await putRecord(record);
  await pruneDurableOutbox(Date.now());
}

export async function hydrateDurableOutboxForRoom(roomId: string): Promise<QueuedSyncCommand[]> {
  await pruneDurableOutbox(Date.now());
  const records = await readRoomRecords(roomId);
  return records.sort(compareRecordOrder).map(toQueuedCommand);
}

export async function removeDurableCommands(
  roomId: string | null,
  requestIds: readonly string[],
): Promise<void> {
  if (!roomId || requestIds.length === 0) return;
  const db = await openDb();
  if (!db) {
    for (const requestId of requestIds) memoryFallback.delete(toMemoryKey(roomId, requestId));
    return;
  }

  await withStore(db, 'readwrite', (store) => {
    for (const requestId of requestIds) store.delete([roomId, requestId]);
  });
}

export async function clearDurableOutboxForRoom(roomId: string | null): Promise<void> {
  if (!roomId) return;
  const records = await readRoomRecords(roomId);
  await removeDurableCommands(
    roomId,
    records.map((record) => record.requestId),
  );
}

export async function syncDurableQueueSnapshot(
  roomId: string | null,
  before: readonly QueuedSyncCommand[],
  after: readonly QueuedSyncCommand[],
): Promise<void> {
  if (!roomId) return;

  const beforeIds = new Set(
    before.filter(isDurableQueued).map((queued) => queued.command.requestId),
  );
  const afterDurable = after.filter(isDurableQueued);
  const afterIds = new Set(afterDurable.map((queued) => queued.command.requestId));
  const removedIds = [...beforeIds].filter((requestId) => !afterIds.has(requestId));

  await removeDurableCommands(roomId, removedIds);
  for (const queued of afterDurable) {
    await persistDurableCommand(queued);
  }
}

export function clearMemoryDurableOutboxForTests(): void {
  memoryFallback.clear();
  openDbPromise = null;
}

function isDurableQueued(queued: QueuedSyncCommand): boolean {
  return shouldPersistDurableCommand(queued.command);
}

function toDurableRecord(queued: QueuedSyncCommand): DurableOutboxRecord {
  const baseRecord = {
    ...queued,
    roomId: queued.command.roomId,
    requestId: queued.command.requestId,
    baseRoomEpoch: queued.command.baseRoomEpoch,
    clientClock: queued.command.clientClock,
    byteSize: 0,
  };
  return { ...baseRecord, byteSize: byteSizeOf(baseRecord) };
}

function toQueuedCommand(record: DurableOutboxRecord): QueuedSyncCommand {
  return {
    command: record.command,
    dependsOnRequestId: record.dependsOnRequestId,
    sendAfter: record.sendAfter,
    createdAt: record.createdAt,
  };
}

function compareRecordOrder(left: DurableOutboxRecord, right: DurableOutboxRecord): number {
  return left.createdAt - right.createdAt || left.requestId.localeCompare(right.requestId);
}

function byteSizeOf(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

async function putRecord(record: DurableOutboxRecord): Promise<void> {
  const db = await openDb();
  if (!db) {
    memoryFallback.set(toMemoryKey(record.roomId, record.requestId), record);
    return;
  }

  await withStore(db, 'readwrite', (store) => {
    store.put(record);
  });
}

async function readRoomRecords(roomId: string): Promise<DurableOutboxRecord[]> {
  const db = await openDb();
  if (!db) {
    return [...memoryFallback.values()].filter((record) => record.roomId === roomId);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index(ROOM_INDEX);
    const request = index.getAll(IDBKeyRange.only(roomId));
    request.onsuccess = () => resolve(request.result as DurableOutboxRecord[]);
    request.onerror = () => reject(request.error ?? new Error('Failed to read sync outbox.'));
  });
}

async function readAllRecords(): Promise<DurableOutboxRecord[]> {
  const db = await openDb();
  if (!db) return [...memoryFallback.values()];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as DurableOutboxRecord[]);
    request.onerror = () => reject(request.error ?? new Error('Failed to read sync outbox.'));
  });
}

async function pruneDurableOutbox(now: number): Promise<void> {
  const records = await readAllRecords();
  const expiredIds = records
    .filter((record) => now - record.createdAt > DURABLE_OUTBOX_TTL_MS)
    .map((record) => record.requestId);

  const byRoom = new Map<string, DurableOutboxRecord[]>();
  for (const record of records) {
    byRoom.set(record.roomId, [...(byRoom.get(record.roomId) ?? []), record]);
  }

  const overflowIds: string[] = [];
  for (const roomRecords of byRoom.values()) {
    const sorted = [...roomRecords].sort(compareRecordOrder);
    const overflow = sorted.slice(
      0,
      Math.max(0, sorted.length - DURABLE_OUTBOX_MAX_COMMANDS_PER_ROOM),
    );
    overflowIds.push(...overflow.map((record) => record.requestId));
  }

  const totalBytes = records.reduce((sum, record) => sum + record.byteSize, 0);
  const totalOverflowIds =
    totalBytes > DURABLE_OUTBOX_SOFT_TOTAL_BYTES ? oldestIdsUntilUnderSoftCap(records) : [];

  const removals = new Map<string, string[]>();
  for (const requestId of [...expiredIds, ...overflowIds, ...totalOverflowIds]) {
    const record = records.find((candidate) => candidate.requestId === requestId);
    if (!record) continue;
    removals.set(record.roomId, [...(removals.get(record.roomId) ?? []), requestId]);
  }

  for (const [roomId, requestIds] of removals) {
    await removeDurableCommands(roomId, requestIds);
  }
}

function oldestIdsUntilUnderSoftCap(records: DurableOutboxRecord[]): string[] {
  let totalBytes = records.reduce((sum, record) => sum + record.byteSize, 0);
  const removedIds: string[] = [];
  for (const record of [...records].sort(compareRecordOrder)) {
    if (totalBytes <= DURABLE_OUTBOX_SOFT_TOTAL_BYTES) break;
    totalBytes -= record.byteSize;
    removedIds.push(record.requestId);
  }
  return removedIds;
}

async function openDb(): Promise<IDBDatabase | null> {
  if (!('indexedDB' in globalThis)) return null;
  if (openDbPromise) return openDbPromise;

  openDbPromise = new Promise((resolve) => {
    const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(STORE_NAME)
        ? request.transaction?.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME, { keyPath: ['roomId', 'requestId'] });
      if (!store) return;
      if (!store.indexNames.contains(ROOM_INDEX)) store.createIndex(ROOM_INDEX, 'roomId');
      if (!store.indexNames.contains(CREATED_AT_INDEX)) {
        store.createIndex(CREATED_AT_INDEX, 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('[sync-outbox] IndexedDB unavailable; durable sync outbox disabled.');
      resolve(null);
    };
  });
  return openDbPromise;
}

function withStore(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  apply: (store: IDBObjectStore) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Sync outbox transaction failed.'));
    tx.onabort = () => reject(tx.error ?? new Error('Sync outbox transaction aborted.'));
    apply(tx.objectStore(STORE_NAME));
  });
}

function toMemoryKey(roomId: string, requestId: string): string {
  return `${roomId}:${requestId}`;
}
