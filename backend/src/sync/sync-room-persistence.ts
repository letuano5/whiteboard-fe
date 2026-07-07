import type {
  CommittedChangeSet,
  Element,
  SlotClockUpdate,
  SyncCommand as SharedSyncCommand,
  SyncSlot,
} from '@vdt/shared';
import { SyncRoomCommandError } from './sync-room-errors.js';
import type {
  SyncRoomExecutionResult,
  SyncRoomPersistence,
  SyncRoomPersistenceCommit,
  SyncRoomPersistencePolicy,
} from './sync-room-contracts.js';

export type SyncRoomPersistenceErrorCode = 'CONDITIONAL_CLOCK_CONFLICT' | 'COMMIT_FAILED';

export class SyncRoomPersistenceError extends Error {
  constructor(
    readonly code: SyncRoomPersistenceErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'SyncRoomPersistenceError';
  }
}

export function toProcessedRequestActorId(actorId: string | null): string {
  return actorId ?? 'anonymous';
}

export function resolveSyncCommandPersistencePolicy(
  command: SharedSyncCommand,
): SyncRoomPersistencePolicy {
  const metadata = readPersistenceMetadata(command);
  const transient = metadata.transient ?? readBooleanProperty(command, 'transient') ?? false;
  const resendable = metadata.resendable ?? !transient;
  const storeProcessedRequest = metadata.storeProcessedRequest ?? resendable;
  const durability = metadata.durability ?? (transient ? 'relaxed' : 'durable');

  if (durability !== 'durable' && durability !== 'relaxed') {
    throw new SyncRoomCommandError('INVALID_PERSISTENCE_POLICY');
  }
  if (storeProcessedRequest === false && resendable) {
    throw new SyncRoomCommandError(
      'INVALID_PERSISTENCE_POLICY',
      'Resendable commands must persist ProcessedRequest.',
    );
  }
  if (transient && (command.kind !== 'patch-slots' || resendable || storeProcessedRequest)) {
    throw new SyncRoomCommandError(
      'INVALID_PERSISTENCE_POLICY',
      'Only non-resendable intermediate patch commands may be transient.',
    );
  }

  return { durability, resendable, storeProcessedRequest };
}

export function isConditionalClockConflict(error: unknown): boolean {
  return error instanceof SyncRoomPersistenceError && error.code === 'CONDITIONAL_CLOCK_CONFLICT';
}

export interface PrismaSyncRoomPersistenceClient {
  $transaction: <T>(task: (tx: PrismaSyncRoomTransaction) => Promise<T>) => Promise<T>;
}

interface PrismaSyncRoomPersistenceOptions {
  afterCommit?: (commit: SyncRoomPersistenceCommit) => Promise<void> | void;
  logger?: Pick<Console, 'error'>;
}

export interface PrismaSyncRoomTransaction {
  $executeRawUnsafe: (query: string) => Promise<unknown>;
  room: {
    updateMany: (args: {
      where: { id: string; documentClock: bigint };
      data: { documentClock: bigint; roomEpoch: bigint };
    }) => Promise<{ count: number }>;
    upsert: (args: {
      where: { id: string };
      create: { id: string; documentClock: bigint; roomEpoch: bigint };
      update: Record<string, never>;
    }) => Promise<unknown>;
    findUnique: (args: {
      where: { id: string };
      select: {
        documentClock: true;
        roomEpoch: true;
        records: { select: { recordId: true; state: true; slotClocks: true } };
        tombstones: { select: { recordId: true } };
      };
    }) => Promise<{
      documentClock: bigint;
      roomEpoch: bigint;
      records: Array<{ recordId: string; state: unknown; slotClocks: unknown }>;
      tombstones: Array<{ recordId: string }>;
    } | null>;
  };
  record: {
    upsert: (args: {
      where: { roomId_recordId: { roomId: string; recordId: string } };
      create: RecordWrite;
      update: Omit<RecordWrite, 'roomId' | 'recordId'>;
    }) => Promise<unknown>;
    deleteMany: (args: { where: { roomId: string; recordId: string } }) => Promise<unknown>;
  };
  tombstone: {
    upsert: (args: {
      where: { roomId_recordId: { roomId: string; recordId: string } };
      create: { roomId: string; recordId: string; deletedClock: bigint };
      update: { deletedClock: bigint };
    }) => Promise<unknown>;
    deleteMany: (args: { where: { roomId: string; recordId?: string } }) => Promise<unknown>;
  };
  processedRequest: {
    findUnique: (args: {
      where: { roomId_actorId_requestId: { roomId: string; actorId: string; requestId: string } };
      select: { payloadHash: true; ack: true };
    }) => Promise<{ payloadHash: string; ack: unknown } | null>;
    create: (args: {
      data: {
        roomId: string;
        actorId: string;
        requestId: string;
        payloadHash: string;
        serverClock: bigint;
        action: string;
        reason?: string;
        ack: unknown;
      };
    }) => Promise<unknown>;
  };
}

interface RecordWrite {
  roomId: string;
  recordId: string;
  typeName: string;
  state: unknown;
  recordClock: bigint;
  slotClocks: unknown;
}

export function createPrismaSyncRoomPersistence(
  db: PrismaSyncRoomPersistenceClient & Pick<PrismaSyncRoomTransaction, 'processedRequest'>,
  options: PrismaSyncRoomPersistenceOptions = {},
): SyncRoomPersistence {
  return {
    async findProcessedRequest({ roomId, actorId, requestId }) {
      const processed = await db.processedRequest.findUnique({
        where: {
          roomId_actorId_requestId: {
            roomId,
            actorId: toProcessedRequestActorId(actorId),
            requestId,
          },
        },
        select: { payloadHash: true, ack: true },
      });

      if (!processed) return null;
      return {
        payloadHash: processed.payloadHash,
        result: assertProcessedResult(processed.ack),
      };
    },
    async commitChangeSet(commit) {
      await db.$transaction(async (tx) => commitPrismaChangeSet(tx, commit));
      if (options.afterCommit) {
        try {
          await options.afterCommit(commit);
        } catch (error) {
          (options.logger ?? console).error('[sync-room-persistence] afterCommit failed:', error);
        }
      }
    },
    async reloadState({ roomId }) {
      return db.$transaction(async (tx) => {
        const room = await tx.room.findUnique({
          where: { id: roomId },
          select: {
            documentClock: true,
            roomEpoch: true,
            records: { select: { recordId: true, state: true, slotClocks: true } },
            tombstones: { select: { recordId: true } },
          },
        });

        if (!room) {
          return { elements: [], documentClock: 0, roomEpoch: 0, slotClocks: [] };
        }

        return {
          elements: room.records.map((record) => record.state as Element),
          documentClock: Number(room.documentClock),
          roomEpoch: Number(room.roomEpoch),
          slotClocks: room.records.flatMap((record) =>
            toSlotClockUpdates(record.recordId, record.slotClocks),
          ),
          tombstoneElementIds: room.tombstones.map((tombstone) => tombstone.recordId),
        };
      });
    },
  };
}

async function commitPrismaChangeSet(
  tx: PrismaSyncRoomTransaction,
  commit: SyncRoomPersistenceCommit,
): Promise<void> {
  if (commit.policy.durability === 'relaxed') {
    await tx.$executeRawUnsafe('SET LOCAL synchronous_commit = off');
  }

  const changeSet = commit.result.changeSet;
  if (changeSet.reason === 'replace_document') {
    await tx.tombstone.deleteMany({ where: { roomId: changeSet.roomId } });
  }

  const updatedRoom = await tx.room.updateMany({
    where: { id: changeSet.roomId, documentClock: BigInt(commit.expectedDocumentClock) },
    data: { documentClock: BigInt(changeSet.serverClock), roomEpoch: BigInt(changeSet.roomEpoch) },
  });

  if (updatedRoom.count !== 1) {
    if (commit.expectedDocumentClock !== 0 || !(await tryCreateFreshRoomRow(tx, commit))) {
      throw new SyncRoomPersistenceError('CONDITIONAL_CLOCK_CONFLICT');
    }
  }

  for (const element of materializedElements(changeSet)) {
    const slotClocks = toRecordSlotClocksJson(commit, element.id);
    const recordClock = BigInt(maxRecordClock(slotClocks, changeSet.serverClock));
    await tx.record.upsert({
      where: { roomId_recordId: { roomId: changeSet.roomId, recordId: element.id } },
      create: {
        roomId: changeSet.roomId,
        recordId: element.id,
        typeName: element.type,
        state: element,
        recordClock,
        slotClocks,
      },
      update: {
        typeName: element.type,
        state: element,
        recordClock,
        slotClocks,
      },
    });
    await tx.tombstone.deleteMany({ where: { roomId: changeSet.roomId, recordId: element.id } });
  }

  for (const elementId of changeSet.deletes) {
    await tx.record.deleteMany({ where: { roomId: changeSet.roomId, recordId: elementId } });
    await tx.tombstone.upsert({
      where: { roomId_recordId: { roomId: changeSet.roomId, recordId: elementId } },
      create: {
        roomId: changeSet.roomId,
        recordId: elementId,
        deletedClock: BigInt(changeSet.serverClock),
      },
      update: { deletedClock: BigInt(changeSet.serverClock) },
    });
  }

  if (commit.policy.storeProcessedRequest) {
    await tx.processedRequest.create({
      data: {
        roomId: changeSet.roomId,
        actorId: toProcessedRequestActorId(commit.actorId),
        requestId: commit.command.requestId,
        payloadHash: commit.payloadHash,
        serverClock: BigInt(changeSet.serverClock),
        action: commit.command.kind,
        reason: changeSet.reason,
        ack: commit.result,
      },
    });
  }
}

// A room created client-side (e.g. "Create new room") has no Room DB row until its first
// SyncRoom commit. Create that row lazily so the first authoritative P5 write succeeds instead
// of permanently failing `CONDITIONAL_CLOCK_CONFLICT` (the conditional updateMany above always
// matches 0 rows when the room has never been persisted).
async function tryCreateFreshRoomRow(
  tx: PrismaSyncRoomTransaction,
  commit: SyncRoomPersistenceCommit,
): Promise<boolean> {
  const changeSet = commit.result.changeSet;
  // Create at the same documentClock=0 baseline a missing room's hot state already assumes
  // (see loadRoomElements). If the row already exists (lost a create race, or genuinely
  // predates this room's hot state with a real clock), this is a no-op and the conditional
  // update below correctly fails, falling through to the existing unhealthy/reload path.
  await tx.room.upsert({
    where: { id: changeSet.roomId },
    create: { id: changeSet.roomId, documentClock: 0n, roomEpoch: 0n },
    update: {},
  });

  const retried = await tx.room.updateMany({
    where: { id: changeSet.roomId, documentClock: 0n },
    data: { documentClock: BigInt(changeSet.serverClock), roomEpoch: BigInt(changeSet.roomEpoch) },
  });
  return retried.count === 1;
}

function materializedElements(changeSet: CommittedChangeSet): Element[] {
  const elements = new Map<string, Element>();
  for (const element of changeSet.puts) elements.set(element.id, element);
  for (const element of changeSet.created) elements.set(element.id, element);
  for (const patched of changeSet.patched) elements.set(patched.elementId, patched.element);
  return [...elements.values()];
}

function toRecordSlotClocksJson(
  commit: SyncRoomPersistenceCommit,
  elementId: string,
): Record<string, { clock: number; lastActorId?: string; lastRequestId?: string }> {
  const changeSet = commit.result.changeSet;
  return Object.fromEntries(
    [...commit.slotClocks.entries()]
      .filter(([key]) => key.startsWith(`${elementId}:`))
      .map(([key, clock]) => [
        key.slice(elementId.length + 1),
        {
          clock,
          lastActorId: changeSet.originActorId ?? undefined,
          lastRequestId: clock === changeSet.serverClock ? changeSet.requestId : undefined,
        },
      ]),
  );
}

function maxRecordClock(
  slotClocks: Record<string, { clock: number }>,
  fallbackClock: number,
): number {
  return Math.max(fallbackClock, ...Object.values(slotClocks).map((slotClock) => slotClock.clock));
}

function toSlotClockUpdates(recordId: string, slotClocks: unknown): SlotClockUpdate[] {
  if (!slotClocks || typeof slotClocks !== 'object' || Array.isArray(slotClocks)) return [];

  return Object.entries(slotClocks).flatMap(([slot, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const clock = (value as { clock?: unknown }).clock;
    if (typeof clock !== 'number' || !Number.isSafeInteger(clock)) return [];
    return [{ elementId: recordId, slot: slot as SyncSlot, clock }];
  });
}

function assertProcessedResult(value: unknown): SyncRoomExecutionResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SyncRoomPersistenceError('COMMIT_FAILED', 'ProcessedRequest ack is malformed.');
  }
  const candidate = value as Partial<SyncRoomExecutionResult>;
  if (!candidate.command || !candidate.changeSet) {
    throw new SyncRoomPersistenceError('COMMIT_FAILED', 'ProcessedRequest ack is malformed.');
  }
  return candidate as SyncRoomExecutionResult;
}

function readPersistenceMetadata(command: SharedSyncCommand): Partial<SyncRoomPersistencePolicy> & {
  transient?: boolean;
} {
  const metadata = readUnknownProperty(command, 'persistence');
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return {
    durability: readDurability(metadata),
    resendable: readBooleanProperty(metadata, 'resendable'),
    storeProcessedRequest: readBooleanProperty(metadata, 'storeProcessedRequest'),
    transient: readBooleanProperty(metadata, 'transient'),
  };
}

function readDurability(value: object): SyncRoomPersistencePolicy['durability'] | undefined {
  const durability = readUnknownProperty(value, 'durability');
  return durability === 'durable' || durability === 'relaxed' ? durability : undefined;
}

function readBooleanProperty(value: object, key: string): boolean | undefined {
  const property = readUnknownProperty(value, key);
  return typeof property === 'boolean' ? property : undefined;
}

function readUnknownProperty(value: object, key: string): unknown {
  return (value as Record<string, unknown>)[key];
}
