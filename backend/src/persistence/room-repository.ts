import type { PrismaClient } from '@prisma/client';
import type { Element } from '@vdt/shared';

// ─── P3A-03: Reconnect diff types ────────────────────────────────────────────

/**
 * Result of getRoomDiff:
 * - mode 'diff': incremental update — only changed/deleted elements since lastServerClock.
 * - mode 'wipe': tombstone history too short — full snapshot (wipe-all fallback).
 *
 * @covers AC-1, AC-8, AC-10, AC-12
 */
export type RoomDiffResult =
  | { mode: 'diff'; changed: Element[]; deleted: Array<{ id: string }>; documentClock: number }
  | { mode: 'wipe'; elements: Element[]; documentClock: number };

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
 * - With targetDocumentClock: writes records/tombstones at that live server clock and
 *   raises Room.documentClock to at least that value.
 * - Without targetDocumentClock: legacy path increments documentClock once.
 * - For non-deleted elements: upserts active Record, deletes matching Tombstone (AC-1, AC-4).
 * - For deleted elements: deletes active Record, upserts Tombstone (AC-3).
 *
 * @param db     Prisma client (or transaction client for testing isolation).
 * @param roomId UUID of the room.
 * @param elements Batch of elements to persist.
 * @param targetDocumentClock Optional live in-memory room clock for P3A-04 flushes.
 * @returns The persisted documentClock, or `null` when the batch is empty.
 */
export async function saveRoomElements(
  db: PrismaClient,
  roomId: string,
  elements: Element[],
  targetDocumentClock?: number,
): Promise<SaveRoomElementsResult | null> {
  // AC-9: empty batch — no writes, no clock increment.
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
          await tx.record.upsert({
            where: { roomId_recordId: { roomId, recordId: el.id } },
            create: {
              roomId,
              recordId: el.id,
              typeName: el.type,
              // Prisma JSON fields require InputJsonValue; Element serializes cleanly
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              state: el as any,
              recordClock: targetClock,
            },
            update: {
              typeName: el.type,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              state: el as any,
              recordClock: targetClock,
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

// ─── P3A-03: Reconnect diff query ────────────────────────────────────────────

/**
 * Computes the reconnect diff for a room since `lastServerClock`.
 *
 * Algorithm (R-03, R-04):
 * 1. Compute tombstoneHistoryStartsAtClock = MIN(tombstone.deletedClock) for the room.
 *    If no tombstones exist, treat as +Infinity → always safe to do incremental diff.
 * 2. If lastServerClock < tombstoneHistoryStartsAtClock: return wipe-all snapshot (AC-8).
 * 3. Else: return incremental diff — DB changed records + DB deleted tombstones since clock.
 *    Overlay any in-memory elements not already covered by the DB changed set (R-03).
 *
 * @param db                  Prisma client.
 * @param roomId              UUID of the room.
 * @param lastServerClock     Last documentClock the client received.
 * @param inMemoryElements    Current in-memory hot-state for the room (may include not-yet-autosaved).
 * @returns RoomDiffResult union — either { mode:'diff', ... } or { mode:'wipe', ... }.
 *
 * @covers AC-1, AC-2, AC-8, AC-10
 */
export async function getRoomDiff(
  db: PrismaClient,
  roomId: string,
  lastServerClock: number,
  inMemoryElements: Element[],
): Promise<RoomDiffResult> {
  // Step 1: Compute tombstoneHistoryStartsAtClock (R-04, FR-003)
  const tombstoneAgg = await db.tombstone.aggregate({
    where: { roomId },
    _min: { deletedClock: true },
  });

  const minDeletedClockRaw = tombstoneAgg._min.deletedClock;
  // If no tombstones exist (null), incremental diff is always safe — no tombstone gap (AC-10).
  // Only wipe when tombstones exist AND lastServerClock predates the earliest tombstone.
  const hasTombstones = minDeletedClockRaw !== null;
  const tombstoneHistoryStartsAtClock = hasTombstones ? Number(minDeletedClockRaw) : Infinity;

  // Step 2: Determine current documentClock for use in both paths
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { documentClock: true },
  });
  const documentClock = room ? Number(room.documentClock) : 0;

  // Step 3: Wipe-all fallback when tombstone history is insufficient (FR-005, AC-8).
  // hasTombstones guard prevents wipe when there are no tombstones at all (AC-10).
  if (hasTombstones && lastServerClock < tombstoneHistoryStartsAtClock) {
    // Return full snapshot of currently active (non-deleted) in-memory elements
    const activeElements = inMemoryElements.filter((e) => !e.isDeleted);
    return { mode: 'wipe', elements: activeElements, documentClock };
  }

  // Step 4: Incremental diff path (FR-004, AC-1, AC-2, AC-10)
  const clock = BigInt(lastServerClock);

  // Changed records: DB elements updated after lastServerClock
  const changedRecords = await db.record.findMany({
    where: { roomId, recordClock: { gt: clock } },
    orderBy: { recordClock: 'asc' },
  });
  const changedFromDb: Element[] = changedRecords.map((r) => r.state as unknown as Element);

  // Deleted tombstones: elements tombstoned after lastServerClock (AC-2)
  const deletedTombstones = await db.tombstone.findMany({
    where: { roomId, deletedClock: { gt: clock } },
    select: { recordId: true },
  });
  const deleted = deletedTombstones.map((t) => ({ id: t.recordId }));

  // Overlay in-memory elements NOT already in DB changed set (R-03)
  // Conservatively adds not-yet-autosaved mutations; LWW handles duplicates on client.
  const changedIds = new Set(changedFromDb.map((e) => e.id));
  const inMemoryOverlay = inMemoryElements.filter(
    (e) => !changedIds.has(e.id) && !e.isDeleted,
  );

  const changed = [...changedFromDb, ...inMemoryOverlay];

  return { mode: 'diff', changed, deleted, documentClock };
}
