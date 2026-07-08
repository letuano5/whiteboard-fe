import type { Prisma, PrismaClient } from '@prisma/client';

export interface TombstoneGcOptions {
  /** Keep tombstones within this many recent document clocks. Default: 100k clocks. */
  retainClockWindow?: number;
  logger?: Pick<typeof console, 'error'>;
}

const DEFAULT_RETAIN_CLOCK_WINDOW = 100_000;
const DEFAULT_GC_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Prunes old tombstones while advancing Room.tombstoneHistoryStartsAtClock first.
 *
 * The cutoff is clock-based because Tombstone has no wall-clock timestamp. A client
 * older than tombstoneHistoryStartsAtClock receives a wipe snapshot instead of an
 * unsafe incremental diff.
 */
export async function gcTombstones(
  db: PrismaClient,
  options: TombstoneGcOptions = {},
): Promise<void> {
  const { retainClockWindow = DEFAULT_RETAIN_CLOCK_WINDOW, logger = console } = options;
  if (retainClockWindow < 1) {
    throw new Error('retainClockWindow must be at least 1.');
  }

  const retainWindow = BigInt(retainClockWindow);
  const candidateRooms = await db.room.findMany({
    where: { documentClock: { gt: retainWindow } },
    select: { id: true },
  });

  for (const room of candidateRooms) {
    try {
      await db.$transaction((tx) => pruneRoomTombstones(tx, room.id, retainWindow));
    } catch (err) {
      logger.error(`[tombstone-gc] Failed to GC room ${room.id}:`, err);
    }
  }
}

/**
 * Runs `gcTombstones` on a recurring interval. Returns a stop function.
 * The timer is unref'd so it never keeps the process alive on its own.
 */
export function startTombstoneGc(
  db: PrismaClient,
  options: TombstoneGcOptions & { intervalMs?: number } = {},
): () => void {
  const { intervalMs = DEFAULT_GC_INTERVAL_MS, ...gcOptions } = options;
  const logger = gcOptions.logger ?? console;
  const timer = setInterval(() => {
    gcTombstones(db, gcOptions).catch((err: unknown) => {
      logger.error('[tombstone-gc] Scheduled run failed:', err);
    });
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

async function pruneRoomTombstones(
  tx: Prisma.TransactionClient,
  roomId: string,
  retainWindow: bigint,
): Promise<void> {
  const room = await tx.room.findUnique({
    where: { id: roomId },
    select: { documentClock: true, tombstoneHistoryStartsAtClock: true },
  });
  if (!room || room.documentClock <= retainWindow) return;

  const pruneThroughClock = room.documentClock - retainWindow;
  const stale = await tx.tombstone.aggregate({
    where: { roomId, deletedClock: { lte: pruneThroughClock } },
    _max: { deletedClock: true },
  });
  const historyStart = stale._max.deletedClock;
  if (historyStart === null) return;

  await tx.room.updateMany({
    where: { id: roomId, tombstoneHistoryStartsAtClock: { lt: historyStart } },
    data: { tombstoneHistoryStartsAtClock: historyStart },
  });
  await tx.tombstone.deleteMany({
    where: { roomId, deletedClock: { lte: historyStart } },
  });
}
