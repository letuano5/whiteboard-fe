import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  Element,
  PendingRequestRef,
  PendingRequestStatus,
  SlotClockUpdate,
  SyncClock,
  SyncSlot,
} from '@vdt/shared';
import type { RecordSlotClocksJson, RoomDiffResult } from './types.js';
import { toProcessedRequestActorId } from '../../sync/sync-room-persistence.js';

interface RoomDiffOptions {
  roomEpoch?: SyncClock;
  pendingRequests?: PendingRequestRef[];
  actorId?: string | null;
}

/**
 * Computes the reconnect diff for a room since `lastServerClock`.
 *
 * Algorithm (P5-07, P5-13A):
 * 1. Read Room.tombstoneHistoryStartsAtClock, which is advanced by tombstone GC before
 *    old tombstones are pruned.
 * 2. If lastServerClock < tombstoneHistoryStartsAtClock: return wipe-all snapshot (AC-8).
 * 3. Else: return incremental diff — DB changed records + DB deleted tombstones since clock.
 *    Overlay any in-memory elements not already covered by the DB changed set (R-03).
 *
 * Slot-aware diff (P5-13A step 2):
 * - Coarse filter by `recordClock > lastServerClock` (uses existing index).
 * - Then filter per-slot: only return slotClock entries where `entry.clock > lastServerClock`.
 *   This allows the client to skip slots that haven't changed since its last known clock.
 *
 * @param db                  Prisma client.
 * @param roomId              UUID of the room.
 * @param lastServerClock     Last documentClock the client received.
 * @param inMemoryElements    Current in-memory hot-state for the room.
 * @returns RoomDiffResult union — either { mode:'diff', ... } or { mode:'wipe', ... }.
 *
 * All reads run inside a single DB transaction so the diff reflects a consistent
 * snapshot at one target clock (P5-07), never a torn read spanning a concurrent commit.
 *
 * @covers AC-1, AC-2, AC-8, AC-10
 */
export async function getRoomDiff(
  db: PrismaClient,
  roomId: string,
  lastServerClock: number,
  inMemoryElements: Element[],
  options: RoomDiffOptions = {},
): Promise<RoomDiffResult> {
  return db.$transaction((tx) =>
    computeRoomDiff(tx, roomId, lastServerClock, inMemoryElements, options),
  );
}

async function computeRoomDiff(
  db: Prisma.TransactionClient,
  roomId: string,
  lastServerClock: number,
  inMemoryElements: Element[],
  options: RoomDiffOptions,
): Promise<RoomDiffResult> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: {
      documentClock: true,
      roomEpoch: true,
      tombstoneHistoryStartsAtClock: true,
      processedRequestHistoryStartsAtClock: true,
    },
  });
  const documentClock = room ? Number(room.documentClock) : 0;
  const roomEpoch = room ? Number(room.roomEpoch ?? 0n) : 0;
  const tombstoneHistoryStartsAtClock =
    room && room.tombstoneHistoryStartsAtClock !== undefined
      ? Number(room.tombstoneHistoryStartsAtClock ?? 0n)
      : 0;
  const processedRequestHistoryStartsAtClock = room
    ? Number(room.processedRequestHistoryStartsAtClock ?? 0n)
    : 0;
  const pendingRequests = await getPendingRequestStatuses(db, roomId, {
    actorId: options.actorId,
    pendingRequests: options.pendingRequests ?? [],
    processedRequestHistoryStartsAtClock,
  });

  if (
    (options.roomEpoch !== undefined && options.roomEpoch !== roomEpoch) ||
    lastServerClock < tombstoneHistoryStartsAtClock
  ) {
    const allRecords = await db.record.findMany({ where: { roomId } });
    const activeElements = allRecords
      .map((record) => record.state as unknown as Element)
      .filter((element) => !element.isDeleted);
    const wipeSlotClocks = extractSlotClocks(allRecords, 0);
    return {
      mode: 'wipe',
      elements: activeElements,
      documentClock,
      serverClock: documentClock,
      roomEpoch,
      slotClocks: wipeSlotClocks,
      processedRequestHistoryStartsAtClock,
      pendingRequests,
    };
  }

  const clock = BigInt(lastServerClock);
  const targetClock = BigInt(documentClock);

  const changedRecords = await db.record.findMany({
    where: { roomId, recordClock: { gt: clock, lte: targetClock } },
    orderBy: { recordClock: 'asc' },
  });
  const changedFromDb: Element[] = changedRecords.map(
    (record) => record.state as unknown as Element,
  );

  const deletedTombstones = await db.tombstone.findMany({
    where: { roomId, deletedClock: { gt: clock, lte: targetClock } },
    select: { recordId: true },
  });
  const deleted = deletedTombstones.map((tombstone) => ({ id: tombstone.recordId }));

  const changedIds = new Set(changedFromDb.map((element) => element.id));
  const inMemoryOverlay = room
    ? []
    : inMemoryElements.filter((element) => !changedIds.has(element.id) && !element.isDeleted);

  const diffSlotClocks = extractSlotClocks(changedRecords, lastServerClock);

  return {
    mode: 'diff',
    changed: [...changedFromDb, ...inMemoryOverlay],
    deleted,
    documentClock,
    serverClock: documentClock,
    roomEpoch,
    fromClock: lastServerClock,
    toClock: documentClock,
    slotClocks: diffSlotClocks,
    hasMore: false,
    pendingRequests,
  };
}

export async function getPendingRequestStatuses(
  db: Prisma.TransactionClient,
  roomId: string,
  options: {
    actorId?: string | null;
    pendingRequests: PendingRequestRef[];
    processedRequestHistoryStartsAtClock?: number;
  },
): Promise<PendingRequestStatus[]> {
  const uniqueRefs = dedupePendingRequestRefs(options.pendingRequests);
  if (uniqueRefs.length === 0) return [];

  const actorId = toProcessedRequestActorId(options.actorId ?? null);
  const processedRequests = await db.processedRequest.findMany({
    where: { roomId, actorId, requestId: { in: uniqueRefs.map((ref) => ref.requestId) } },
    select: { requestId: true, serverClock: true, reason: true },
  });
  const processedById = new Map(processedRequests.map((request) => [request.requestId, request]));
  const historyStart = options.processedRequestHistoryStartsAtClock ?? 0;

  return uniqueRefs.map(({ requestId, clientClock }) => {
    const processed = processedById.get(requestId);
    if (processed) {
      return {
        requestId,
        status: 'processed',
        serverClock: Number(processed.serverClock),
        reason: processed.reason ?? undefined,
      };
    }
    // Only classify as expired when this command's clientClock predates the GC cutoff — if
    // it had been processed, its serverClock would exceed clientClock, and thus exceed
    // historyStart too, meaning it would still exist in ProcessedRequest (not GC'd). A
    // command with clientClock >= historyStart genuinely was never received by the server.
    if (clientClock < historyStart) {
      return { requestId, status: 'expired', reason: 'idempotency_history_gc' };
    }
    return { requestId, status: 'unknown' };
  });
}

function dedupePendingRequestRefs(refs: PendingRequestRef[]): PendingRequestRef[] {
  const byRequestId = new Map<string, PendingRequestRef>();
  for (const ref of refs) {
    if (ref.requestId.length === 0) continue;
    byRequestId.set(ref.requestId, ref);
  }
  return [...byRequestId.values()];
}

/**
 * Extracts SlotClockUpdate entries from a set of records.
 * Only returns entries whose clock > sinceServerClock (step 2 of the 2-step filter).
 * Pass sinceServerClock = 0 to get all slot clocks (for wipe-all / full load).
 */
function extractSlotClocks(
  records: Array<{ recordId: string; slotClocks: unknown }>,
  sinceServerClock: number,
): SlotClockUpdate[] {
  const result: SlotClockUpdate[] = [];
  for (const record of records) {
    const json = (record.slotClocks ?? {}) as unknown as RecordSlotClocksJson;
    for (const [slot, entry] of Object.entries(json)) {
      if (entry.clock > sinceServerClock) {
        result.push({ elementId: record.recordId, slot: slot as SyncSlot, clock: entry.clock });
      }
    }
  }
  return result;
}
