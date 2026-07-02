import type { PrismaClient } from '@prisma/client';
import { loadRoomElements } from '../persistence/room-repository.js';
import { SyncRoom } from './sync-room.js';
import { createPrismaSyncRoomPersistence } from './sync-room-persistence.js';

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

  const loaded = await loadRoomElements(db, roomId);
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
}
