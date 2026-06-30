import type { PrismaClient } from '@prisma/client';
import type { Element } from '@vdt/shared';
import type { RoomDiffResult } from './types.js';

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
 * @param inMemoryElements    Current in-memory hot-state for the room.
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
  const tombstoneAgg = await db.tombstone.aggregate({
    where: { roomId },
    _min: { deletedClock: true },
  });

  const minDeletedClockRaw = tombstoneAgg._min.deletedClock;
  const hasTombstones = minDeletedClockRaw !== null;
  const tombstoneHistoryStartsAtClock = hasTombstones ? Number(minDeletedClockRaw) : Infinity;

  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { documentClock: true },
  });
  const documentClock = room ? Number(room.documentClock) : 0;

  if (hasTombstones && lastServerClock < tombstoneHistoryStartsAtClock) {
    const activeElements = inMemoryElements.filter((element) => !element.isDeleted);
    return { mode: 'wipe', elements: activeElements, documentClock };
  }

  const clock = BigInt(lastServerClock);

  const changedRecords = await db.record.findMany({
    where: { roomId, recordClock: { gt: clock } },
    orderBy: { recordClock: 'asc' },
  });
  const changedFromDb: Element[] = changedRecords.map(
    (record) => record.state as unknown as Element,
  );

  const deletedTombstones = await db.tombstone.findMany({
    where: { roomId, deletedClock: { gt: clock } },
    select: { recordId: true },
  });
  const deleted = deletedTombstones.map((tombstone) => ({ id: tombstone.recordId }));

  const changedIds = new Set(changedFromDb.map((element) => element.id));
  const inMemoryOverlay = inMemoryElements.filter(
    (element) => !changedIds.has(element.id) && !element.isDeleted,
  );

  return {
    mode: 'diff',
    changed: [...changedFromDb, ...inMemoryOverlay],
    deleted,
    documentClock,
  };
}
