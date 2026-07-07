import type { Element, Presence } from '@vdt/shared';
import type { SyncRoom } from '../sync/index.js';
import {
  DEFAULT_SYNC_ROOM_GC_INTERVAL_MS,
  DEFAULT_SYNC_ROOM_IDLE_TTL_MS,
  evictIdleSyncRooms,
} from '../sync/sync-room-registry.js';

type RoomPresenceStore = Map<string, Map<string, Presence>>;
type RoomElementStore = Map<string, Map<string, Element>>;
type RoomClockStore = Map<string, number>;

interface RoomCacheMetadata {
  lastAccessedAt: number;
}

export interface HotRoomGcDeps {
  roomPresence: RoomPresenceStore;
  roomElements: RoomElementStore;
  roomClocks: RoomClockStore;
  syncRooms: Map<string, SyncRoom>;
}

export interface HotRoomGcOptions {
  idleTtlMs?: number;
  intervalMs?: number;
  now?: number;
  logger?: Pick<typeof console, 'error'>;
}

const cacheMetadata = new WeakMap<object, Map<string, RoomCacheMetadata>>();

export function touchRoomCache(
  roomElements: RoomElementStore,
  roomId: string,
  now = Date.now(),
): void {
  getCacheMetadata(roomElements).set(roomId, { lastAccessedAt: now });
}

export function forgetRoomCache(roomElements: object | undefined, roomId: string): void {
  if (!roomElements) return;
  getCacheMetadata(roomElements).delete(roomId);
}

export async function evictIdleHotRooms(
  deps: HotRoomGcDeps,
  options: HotRoomGcOptions = {},
): Promise<{ syncRooms: number; roomCaches: number }> {
  const idleTtlMs = options.idleTtlMs ?? DEFAULT_SYNC_ROOM_IDLE_TTL_MS;
  const now = options.now ?? Date.now();
  const syncRooms = evictIdleSyncRooms(deps.syncRooms, {
    idleTtlMs,
    now,
    hasActiveSockets: (roomId) => hasActiveSockets(deps.roomPresence, roomId),
    onEvict: (roomId) => {
      deps.roomElements.delete(roomId);
      deps.roomClocks.delete(roomId);
      forgetRoomCache(deps.roomElements, roomId);
    },
  });
  const roomCaches = await evictIdleRoomCaches(deps, { idleTtlMs, now });
  return { syncRooms, roomCaches };
}

export function startHotRoomGc(deps: HotRoomGcDeps, options: HotRoomGcOptions = {}): () => void {
  const intervalMs = options.intervalMs ?? DEFAULT_SYNC_ROOM_GC_INTERVAL_MS;
  const logger = options.logger ?? console;
  const timer = setInterval(() => {
    evictIdleHotRooms(deps, options).catch((error: unknown) => {
      logger.error('[hot-room-gc] Scheduled eviction failed:', error);
    });
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

async function evictIdleRoomCaches(
  deps: HotRoomGcDeps,
  options: Required<Pick<HotRoomGcOptions, 'idleTtlMs' | 'now'>>,
): Promise<number> {
  const metadata = getCacheMetadata(deps.roomElements);
  let evicted = 0;

  for (const roomId of deps.roomElements.keys()) {
    if (hasActiveSockets(deps.roomPresence, roomId)) continue;
    if (deps.syncRooms.has(roomId)) continue;

    const roomMetadata = metadata.get(roomId) ?? { lastAccessedAt: 0 };
    if (options.now - roomMetadata.lastAccessedAt < options.idleTtlMs) continue;

    deps.roomElements.delete(roomId);
    deps.roomClocks.delete(roomId);
    metadata.delete(roomId);
    evicted += 1;
  }

  return evicted;
}

function hasActiveSockets(roomPresence: RoomPresenceStore, roomId: string): boolean {
  return (roomPresence.get(roomId)?.size ?? 0) > 0;
}

function getCacheMetadata(roomElements: object): Map<string, RoomCacheMetadata> {
  const existing = cacheMetadata.get(roomElements);
  if (existing) return existing;
  const metadata = new Map<string, RoomCacheMetadata>();
  cacheMetadata.set(roomElements, metadata);
  return metadata;
}
