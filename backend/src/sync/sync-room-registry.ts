import type { PrismaClient } from '@prisma/client';
import { loadRoomElements } from '../persistence/room-repository.js';
import { captureIntervalSnapshotForCommit } from '../rooms/room-snapshots.js';
import { SyncRoom } from './sync-room.js';
import { createPrismaSyncRoomPersistence } from './sync-room-persistence.js';

export const DEFAULT_SYNC_ROOM_IDLE_TTL_MS = 10 * 60 * 1000;
export const DEFAULT_SYNC_ROOM_GC_INTERVAL_MS = 60 * 1000;

interface SyncRoomEntryMetadata {
  lastAccessedAt: number;
  activeLeaseCount: number;
}

interface SyncRoomRegistryState {
  loading: Map<string, Promise<SyncRoom>>;
  invalidatedLoads: Set<Promise<SyncRoom>>;
  entries: Map<string, SyncRoomEntryMetadata>;
  loadCount: number;
  evictedCount: number;
}

export interface SyncRoomRegistryMetrics {
  hotRoomCount: number;
  loadingRoomCount: number;
  loadCount: number;
  evictedCount: number;
}

export interface EvictIdleSyncRoomsOptions {
  idleTtlMs?: number;
  now?: number;
  hasActiveSockets?: (roomId: string) => boolean;
  onEvict?: (roomId: string, room: SyncRoom) => void;
}

export interface StartSyncRoomRegistryGcOptions extends EvictIdleSyncRoomsOptions {
  intervalMs?: number;
  logger?: Pick<typeof console, 'error'>;
}

const registryStates = new WeakMap<Map<string, SyncRoom>, SyncRoomRegistryState>();

/**
 * Returns the single hot `SyncRoom` for a room, loading it from Postgres on first
 * use. Sharing one instance (and therefore one per-room actor) across the socket
 * command path and the HTTP import/replace path guarantees every mutation for a
 * room is serialized through the same queue instead of racing two actors.
 */
export async function getOrCreateSyncRoom(
  db: PrismaClient,
  syncRooms: Map<string, SyncRoom>,
  roomId: string,
): Promise<SyncRoom> {
  const state = getRegistryState(syncRooms);
  const existing = syncRooms.get(roomId);
  if (existing) {
    markAccess(state, roomId);
    return existing;
  }

  const pending = state.loading.get(roomId);
  if (pending) return pending;

  let promise: Promise<SyncRoom>;
  promise = loadRoomElements(db, roomId)
    .then((loaded) => {
      const room = new SyncRoom({
        roomId,
        elements: loaded.elements,
        documentClock: loaded.documentClock,
        roomEpoch: loaded.roomEpoch,
        slotClocks: loaded.slotClocks,
        tombstoneElementIds: loaded.tombstoneElementIds,
        persistence: createPrismaSyncRoomPersistence(
          db as unknown as Parameters<typeof createPrismaSyncRoomPersistence>[0],
          {
            afterCommit: async (commit) => {
              await captureIntervalSnapshotForCommit(
                db as unknown as Parameters<typeof captureIntervalSnapshotForCommit>[0],
                commit,
              );
            },
          },
        ),
      });
      if (!state.invalidatedLoads.delete(promise)) {
        syncRooms.set(roomId, room);
        markAccess(state, roomId);
        state.loadCount += 1;
      }
      return room;
    })
    .finally(() => {
      if (state.loading.get(roomId) === promise) {
        state.loading.delete(roomId);
      }
    });
  state.loading.set(roomId, promise);
  return promise;
}

export async function withSyncRoom<T>(
  db: PrismaClient,
  syncRooms: Map<string, SyncRoom>,
  roomId: string,
  task: (room: SyncRoom) => T | Promise<T>,
): Promise<T> {
  const room = await getOrCreateSyncRoom(db, syncRooms, roomId);
  const state = getRegistryState(syncRooms);
  const metadata = markAccess(state, roomId);
  metadata.activeLeaseCount += 1;
  try {
    return await task(room);
  } finally {
    metadata.activeLeaseCount = Math.max(0, metadata.activeLeaseCount - 1);
    metadata.lastAccessedAt = Date.now();
  }
}

export function deleteSyncRoom(syncRooms: Map<string, SyncRoom> | undefined, roomId: string): void {
  if (!syncRooms) return;
  const state = getRegistryState(syncRooms);
  const pending = state.loading.get(roomId);
  if (pending) {
    state.invalidatedLoads.add(pending);
  }
  syncRooms.delete(roomId);
  state.entries.delete(roomId);
  state.loading.delete(roomId);
}

export function evictIdleSyncRooms(
  syncRooms: Map<string, SyncRoom>,
  options: EvictIdleSyncRoomsOptions = {},
): number {
  const {
    idleTtlMs = DEFAULT_SYNC_ROOM_IDLE_TTL_MS,
    now = Date.now(),
    hasActiveSockets = () => false,
    onEvict,
  } = options;
  const state = getRegistryState(syncRooms);
  let evicted = 0;

  for (const [roomId, room] of syncRooms) {
    const metadata = ensureMetadata(state, roomId);
    if (now - metadata.lastAccessedAt < idleTtlMs) continue;
    if (metadata.activeLeaseCount > 0) continue;
    if (state.loading.has(roomId)) continue;
    if (hasActiveSockets(roomId)) continue;

    syncRooms.delete(roomId);
    state.entries.delete(roomId);
    state.evictedCount += 1;
    evicted += 1;
    onEvict?.(roomId, room);
  }

  return evicted;
}

export function getSyncRoomRegistryMetrics(
  syncRooms: Map<string, SyncRoom>,
): SyncRoomRegistryMetrics {
  const state = getRegistryState(syncRooms);
  return {
    hotRoomCount: syncRooms.size,
    loadingRoomCount: state.loading.size,
    loadCount: state.loadCount,
    evictedCount: state.evictedCount,
  };
}

export function startSyncRoomRegistryGc(
  syncRooms: Map<string, SyncRoom>,
  options: StartSyncRoomRegistryGcOptions = {},
): () => void {
  const {
    intervalMs = DEFAULT_SYNC_ROOM_GC_INTERVAL_MS,
    logger = console,
    ...evictionOptions
  } = options;
  const timer = setInterval(() => {
    try {
      evictIdleSyncRooms(syncRooms, evictionOptions);
    } catch (error) {
      logger.error('[sync-room-gc] Scheduled eviction failed:', error);
    }
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

function getRegistryState(syncRooms: Map<string, SyncRoom>): SyncRoomRegistryState {
  const existing = registryStates.get(syncRooms);
  if (existing) return existing;
  const state: SyncRoomRegistryState = {
    loading: new Map<string, Promise<SyncRoom>>(),
    invalidatedLoads: new Set<Promise<SyncRoom>>(),
    entries: new Map<string, SyncRoomEntryMetadata>(),
    loadCount: 0,
    evictedCount: 0,
  };
  registryStates.set(syncRooms, state);
  return state;
}

function markAccess(state: SyncRoomRegistryState, roomId: string): SyncRoomEntryMetadata {
  const metadata = ensureMetadata(state, roomId);
  metadata.lastAccessedAt = Date.now();
  return metadata;
}

function ensureMetadata(state: SyncRoomRegistryState, roomId: string): SyncRoomEntryMetadata {
  const existing = state.entries.get(roomId);
  if (existing) return existing;

  const metadata: SyncRoomEntryMetadata = {
    lastAccessedAt: Date.now(),
    activeLeaseCount: 0,
  };
  state.entries.set(roomId, metadata);
  return metadata;
}
