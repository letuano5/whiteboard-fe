import type { PrismaClient } from '@prisma/client';
import type { Element } from '@vdt/shared';

export interface SaveRoomElementsResult {
  /** New documentClock after the transaction. */
  documentClock: bigint;
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
