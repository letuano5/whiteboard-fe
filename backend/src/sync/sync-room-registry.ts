import type { PrismaClient } from '@prisma/client';
import { loadRoomElements } from '../persistence/room-repository.js';
import { SyncRoom } from './sync-room.js';
import { createPrismaSyncRoomPersistence } from './sync-room-persistence.js';

const loadingSyncRooms = new WeakMap<Map<string, SyncRoom>, Map<string, Promise<SyncRoom>>>();

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
  const existing = syncRooms.get(roomId);
  if (existing) return existing;

  const loading = getLoadingMap(syncRooms);
  const pending = loading.get(roomId);
  if (pending) return pending;

  const promise = loadRoomElements(db, roomId)
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
        ),
      });
      syncRooms.set(roomId, room);
      return room;
    })
    .finally(() => {
      loading.delete(roomId);
    });
  loading.set(roomId, promise);
  return promise;
}

function getLoadingMap(syncRooms: Map<string, SyncRoom>): Map<string, Promise<SyncRoom>> {
  const existing = loadingSyncRooms.get(syncRooms);
  if (existing) return existing;
  const loading = new Map<string, Promise<SyncRoom>>();
  loadingSyncRooms.set(syncRooms, loading);
  return loading;
}
