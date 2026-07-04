import type { PrismaClient } from '@prisma/client';
import type { Element } from '@vdt/shared';
import type { RecordSlotClocksJson, SaveRoomElementsResult } from './types.js';

/**
 * Persists a batch of elements for a room in a single Prisma transaction.
 *
 * - Returns without writing when `elements` is empty (AC-9).
 * - Creates or upserts the Room row.
 * - With targetDocumentClock: writes records/tombstones at that live server clock and
 *   raises Room.documentClock to at least that value.
 * - Without targetDocumentClock: legacy path increments documentClock once.
 * - For non-deleted elements: upserts active Record, deletes matching Tombstone (AC-1, AC-4).
 * - For deleted elements: deletes active Record, upserts Tombstone (AC-3).
 * - slotClocksMap (optional): per-element slot clock JSON to write alongside state.
 *   When absent, Record.slotClocks keeps its default `{}`.
 *   P5-06 will supply this map; legacy P3A callers omit it.
 *
 * @param db     Prisma client (or transaction client for testing isolation).
 * @param roomId UUID of the room.
 * @param elements Batch of elements to persist.
 * @param targetDocumentClock Optional live in-memory room clock for P3A-04 flushes.
 * @param slotClocksMap Optional per-elementId slot clock JSON for P5 persistence path.
 * @returns The persisted documentClock, or `null` when the batch is empty.
 */
export async function saveRoomElements(
  db: PrismaClient,
  roomId: string,
  elements: Element[],
  targetDocumentClock?: number,
  slotClocksMap?: Map<string, RecordSlotClocksJson>,
): Promise<SaveRoomElementsResult | null> {
  if (elements.length === 0) {
    return null;
  }

  if (targetDocumentClock !== undefined) {
    const targetClock = BigInt(targetDocumentClock);

    const result = await db.$transaction(async (tx) => {
      await tx.room.upsert({
        where: { id: roomId },
        create: { id: roomId, documentClock: targetClock },
        update: {},
      });

      const currentRoom = await tx.room.findUnique({
        where: { id: roomId },
        select: { documentClock: true },
      });
      const currentClock = currentRoom?.documentClock ?? targetClock;
      const persistedRoomClock = currentClock > targetClock ? currentClock : targetClock;

      if (currentClock < targetClock) {
        await tx.room.update({
          where: { id: roomId },
          data: { documentClock: targetClock },
        });
      }

      for (const el of elements) {
        if (!el.isDeleted) {
          const slotClocks = slotClocksMap?.get(el.id) ?? {};
          await tx.record.upsert({
            where: { roomId_recordId: { roomId, recordId: el.id } },
            create: {
              roomId,
              recordId: el.id,
              typeName: el.type,
              // Prisma JSON fields require InputJsonValue; Element serializes cleanly.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              state: el as any,
              recordClock: targetClock,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              slotClocks: slotClocks as any,
            },
            update: {
              typeName: el.type,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              state: el as any,
              recordClock: targetClock,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              slotClocks: slotClocks as any,
            },
          });
          await tx.tombstone.deleteMany({
            where: { roomId, recordId: el.id },
          });
        } else {
          await tx.record.deleteMany({
            where: { roomId, recordId: el.id },
          });
          await tx.tombstone.upsert({
            where: { roomId_recordId: { roomId, recordId: el.id } },
            create: { roomId, recordId: el.id, deletedClock: targetClock },
            update: { deletedClock: targetClock },
          });
        }
      }

      return persistedRoomClock;
    });

    return { documentClock: result };
  }

  const result = await db.$transaction(async (tx) => {
    await tx.room.upsert({
      where: { id: roomId },
      create: { id: roomId, documentClock: 0n },
      update: {},
    });

    const updated = await tx.room.update({
      where: { id: roomId },
      data: { documentClock: { increment: 1n } },
      select: { documentClock: true },
    });
    const newClock = updated.documentClock;

    for (const el of elements) {
      if (!el.isDeleted) {
        const slotClocks = slotClocksMap?.get(el.id) ?? {};
        await tx.record.upsert({
          where: { roomId_recordId: { roomId, recordId: el.id } },
          create: {
            roomId,
            recordId: el.id,
            typeName: el.type,
            // Prisma JSON fields require InputJsonValue; Element serializes cleanly.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            state: el as any,
            recordClock: newClock,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            slotClocks: slotClocks as any,
          },
          update: {
            typeName: el.type,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            state: el as any,
            recordClock: newClock,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            slotClocks: slotClocks as any,
          },
        });
        await tx.tombstone.deleteMany({
          where: { roomId, recordId: el.id },
        });
      } else {
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
