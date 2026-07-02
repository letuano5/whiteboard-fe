import type { PrismaClient } from '@prisma/client';
import type { Element, SlotClockUpdate, SyncSlot } from '@vdt/shared';
import type { LoadRoomResult, RecordSlotClocksJson } from './types.js';

/**
 * Loads all active records for a room from the database.
 *
 * - Returns `{ elements: [], documentClock: 0, slotClocks: [] }` when the room does not exist.
 * - Converts BigInt `documentClock` to `number` at the boundary.
 * - Extracts `slotClocks` from each Record's JSON column for SyncRoom initialisation.
 *
 * @param db     Prisma client.
 * @param roomId UUID of the room.
 * @returns Active elements, the room's current documentClock, and all per-slot clocks.
 */
export async function loadRoomElements(db: PrismaClient, roomId: string): Promise<LoadRoomResult> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    include: { records: true },
  });

  if (!room) {
    return { elements: [], documentClock: 0, slotClocks: [] };
  }

  const elements: Element[] = [];
  const slotClocks: SlotClockUpdate[] = [];

  for (const record of room.records) {
    elements.push(record.state as unknown as Element);
    const json = ((record.slotClocks ?? {}) as unknown) as RecordSlotClocksJson;
    for (const [slot, entry] of Object.entries(json)) {
      slotClocks.push({ elementId: record.recordId, slot: slot as SyncSlot, clock: entry.clock });
    }
  }

  return { elements, documentClock: Number(room.documentClock), slotClocks };
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
