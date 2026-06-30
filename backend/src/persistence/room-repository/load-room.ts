import type { PrismaClient } from '@prisma/client';
import type { Element } from '@vdt/shared';
import type { LoadRoomResult } from './types.js';

/**
 * Loads all active records for a room from the database.
 *
 * - Returns `{ elements: [], documentClock: 0 }` when the room does not exist.
 * - Converts BigInt `documentClock` to `number` at the boundary.
 *
 * @param db     Prisma client.
 * @param roomId UUID of the room.
 * @returns Active elements and the room's current documentClock.
 */
export async function loadRoomElements(db: PrismaClient, roomId: string): Promise<LoadRoomResult> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    include: { records: true },
  });

  if (!room) {
    return { elements: [], documentClock: 0 };
  }

  const elements = room.records.map((record) => record.state as unknown as Element);
  return { elements, documentClock: Number(room.documentClock) };
}

/**
 * Returns the current documentClock for a room without loading element records.
 *
 * - Returns `0` when the room does not exist.
 * - Converts BigInt to `number` at the boundary.
 *
 * @param db     Prisma client.
 * @param roomId UUID of the room.
 * @returns The room's current documentClock as a number.
 */
export async function getRoomClock(db: PrismaClient, roomId: string): Promise<number> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { documentClock: true },
  });

  if (!room) {
    return 0;
  }

  return Number(room.documentClock);
}
