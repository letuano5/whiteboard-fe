import type { PrismaClient } from '@prisma/client';

export interface ProcessedRequestGcOptions {
  /** ProcessedRequest rows older than this are eligible for deletion. Default: 24h. */
  maxAgeMs?: number;
  logger?: Pick<typeof console, 'error'>;
}

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GC_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Deletes stale ProcessedRequest rows and advances each affected room's
 * processedRequestHistoryStartsAtClock so a reconnecting client that asks about a
 * GC'd requestId gets an explicit 'expired' status instead of a silent 'unknown'
 * (see getPendingRequestStatuses in room-diff.ts).
 *
 * The history-start clock is bumped before the rows are deleted so a crash between
 * the two steps only leaves stale rows a little longer — it never lets a deleted
 * row masquerade as 'unknown'.
 */
export async function gcProcessedRequests(
  db: PrismaClient,
  options: ProcessedRequestGcOptions = {},
): Promise<void> {
  const { maxAgeMs = DEFAULT_MAX_AGE_MS, logger = console } = options;
  const cutoff = new Date(Date.now() - maxAgeMs);

  const staleGroups = await db.processedRequest.groupBy({
    by: ['roomId'],
    where: { createdAt: { lt: cutoff } },
    _max: { serverClock: true },
  });

  for (const group of staleGroups) {
    const historyStart = group._max.serverClock;
    if (historyStart === null) continue;
    try {
      await db.room.updateMany({
        where: { id: group.roomId, processedRequestHistoryStartsAtClock: { lt: historyStart } },
        data: { processedRequestHistoryStartsAtClock: historyStart },
      });
      await db.processedRequest.deleteMany({
        where: { roomId: group.roomId, createdAt: { lt: cutoff } },
      });
    } catch (err) {
      logger.error(`[processed-request-gc] Failed to GC room ${group.roomId}:`, err);
    }
  }
}

/**
 * Runs `gcProcessedRequests` on a recurring interval. Returns a stop function.
 * The timer is unref'd so it never keeps the process alive on its own.
 */
export function startProcessedRequestGc(
  db: PrismaClient,
  options: ProcessedRequestGcOptions & { intervalMs?: number } = {},
): () => void {
  const { intervalMs = DEFAULT_GC_INTERVAL_MS, ...gcOptions } = options;
  const logger = gcOptions.logger ?? console;
  const timer = setInterval(() => {
    gcProcessedRequests(db, gcOptions).catch((err: unknown) => {
      logger.error('[processed-request-gc] Scheduled run failed:', err);
    });
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
