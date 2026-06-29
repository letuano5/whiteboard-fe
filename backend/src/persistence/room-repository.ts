import type { PrismaClient } from '@prisma/client';
import type { Element } from '@vdt/shared';

export interface SaveRoomElementsResult {
  /** New documentClock after the transaction. */
  documentClock: bigint;
}

export interface LoadRoomResult {
  /** Active (non-deleted) elements loaded from DB. */
  elements: Element[];
  /** documentClock converted from BigInt at repository boundary. */
  documentClock: number;
}

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

  const elements = room.records.map((r) => r.state as unknown as Element);
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

/**
 * Persists a batch of elements for a room in a single Prisma transaction.
 *
 * - Returns without writing when `elements` is empty (AC-9).
 * - Creates or upserts the Room row.
 * - Increments `documentClock` exactly once per non-empty transaction (AC-2).
 * - For non-deleted elements: upserts active Record, deletes matching Tombstone (AC-1, AC-4).
 * - For deleted elements: deletes active Record, upserts Tombstone (AC-3).
 *
 * @param db     Prisma client (or transaction client for testing isolation).
 * @param roomId UUID of the room.
 * @param elements Batch of elements to persist.
 * @returns The new documentClock, or `null` when the batch is empty.
 */
export async function saveRoomElements(
  db: PrismaClient,
  roomId: string,
  elements: Element[],
): Promise<SaveRoomElementsResult | null> {
  // AC-9: empty batch — no writes, no clock increment.
  if (elements.length === 0) {
    return null;
  }

  const result = await db.$transaction(async (tx) => {
    // Upsert Room (FR-003)
    await tx.room.upsert({
      where: { id: roomId },
      create: { id: roomId, documentClock: 0n },
      update: {},
    });

    // Increment documentClock by exactly 1 (FR-004)
    const updated = await tx.room.update({
      where: { id: roomId },
      data: { documentClock: { increment: 1n } },
      select: { documentClock: true },
    });
    const newClock = updated.documentClock;

    for (const el of elements) {
      if (!el.isDeleted) {
        // FR-005: upsert active Record, clear any matching Tombstone (FR-007)
        await tx.record.upsert({
          where: { roomId_recordId: { roomId, recordId: el.id } },
          create: {
            roomId,
            recordId: el.id,
            typeName: el.type,
            // Prisma JSON fields require InputJsonValue; Element serializes cleanly
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            state: el as any,
            recordClock: newClock,
          },
          update: {
            typeName: el.type,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            state: el as any,
            recordClock: newClock,
          },
        });
        // Clear tombstone if one exists (FR-007)
        await tx.tombstone.deleteMany({
          where: { roomId, recordId: el.id },
        });
      } else {
        // FR-006: delete active Record, upsert Tombstone
        await tx.record.deleteMany({
          where: { roomId, recordId: el.id },
        });
        await tx.tombstone.upsert({
          where: { roomId_recordId: { roomId, recordId: el.id } },
          create: { roomId, recordId: el.id, deletedClock: newClock },
          update: { deletedClock: newClock },
        });
      }
    }

    return newClock;
  });

  return { documentClock: result };
}
