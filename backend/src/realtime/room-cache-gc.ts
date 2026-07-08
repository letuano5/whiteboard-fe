import type { Presence } from '@vdt/shared';
import type { SyncRoom } from '../sync/index.js';
import {
  DEFAULT_SYNC_ROOM_GC_INTERVAL_MS,
  DEFAULT_SYNC_ROOM_IDLE_TTL_MS,
  evictIdleSyncRooms,
} from '../sync/sync-room-registry.js';

type RoomPresenceStore = Map<string, Map<string, Presence>>;

export interface HotRoomGcDeps {
  roomPresence: RoomPresenceStore;
  syncRooms: Map<string, SyncRoom>;
}

export interface HotRoomGcOptions {
  idleTtlMs?: number;
  intervalMs?: number;
  now?: number;
  logger?: Pick<typeof console, 'error'>;
}

export async function evictIdleHotRooms(
  deps: HotRoomGcDeps,
  options: HotRoomGcOptions = {},
): Promise<{ syncRooms: number }> {
  const idleTtlMs = options.idleTtlMs ?? DEFAULT_SYNC_ROOM_IDLE_TTL_MS;
  const now = options.now ?? Date.now();
  const syncRooms = evictIdleSyncRooms(deps.syncRooms, {
    idleTtlMs,
    now,
    hasActiveSockets: (roomId) => hasActiveSockets(deps.roomPresence, roomId),
  });
  return { syncRooms };
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

function hasActiveSockets(roomPresence: RoomPresenceStore, roomId: string): boolean {
  return (roomPresence.get(roomId)?.size ?? 0) > 0;
}
