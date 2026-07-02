import type { CommittedChangeSet, Element, SlotClockUpdate, SyncClock } from '@vdt/shared';
import type { SyncCommand as SharedSyncCommand } from '@vdt/shared';
import { RoomActor } from './room-actor.js';
import {
  assertChangeSetWithinLimit,
  createChangeSet,
  toSlotClockKey,
} from './sync-room-change-set.js';
import { SyncRoomCommandError } from './sync-room-errors.js';
import { MAX_CHANGESET_BYTES } from './sync-room-limits.js';
import { toCommandPayloadHash } from './sync-room-payload-hash.js';
import {
  isConditionalClockConflict,
  resolveSyncCommandPersistencePolicy,
} from './sync-room-persistence.js';
import { defaultSyncRoomPlanner } from './sync-room-planner.js';
import type {
  SyncRoomActorContext,
  SyncRoomCommitOutcome,
  SyncRoomExecutionResult,
  SyncRoomPersistence,
  SyncRoomProcessedRequest,
  SyncRoomPlanner,
  SyncRoomReferenceValidator,
  SyncRoomReloadState,
  SyncRoomStateSnapshot,
} from './sync-room-contracts.js';

export type {
  SyncRoomActorContext,
  SyncRoomCommitOutcome,
  SyncRoomExecutionResult,
  SyncRoomPlan,
  SyncRoomPersistence,
  SyncRoomPersistenceCommit,
  SyncRoomPersistenceDurability,
  SyncRoomPersistencePolicy,
  SyncRoomProcessedRequest,
  SyncRoomPlanner,
  SyncRoomPlannerContext,
  SyncRoomReferenceValidator,
  SyncRoomReloadState,
  SyncRoomStateSnapshot,
} from './sync-room-contracts.js';

interface SyncRoomOptions {
  roomId: string;
  elements?: Iterable<Element>;
  documentClock?: SyncClock;
  roomEpoch?: SyncClock;
  slotClocks?: Iterable<SlotClockUpdate>;
  tombstoneElementIds?: Iterable<string>;
  planner?: SyncRoomPlanner;
  referenceValidator?: SyncRoomReferenceValidator;
  maxChangeSetBytes?: number;
  persistence?: SyncRoomPersistence;
}

interface SyncRoomCriticalSectionResult {
  result: SyncRoomExecutionResult;
  replayed: boolean;
  afterApply?: (changeSet: CommittedChangeSet) => void | Promise<void>;
}

export class SyncRoom {
  private readonly actor = new RoomActor();
  private outputTail: Promise<void> = Promise.resolve();
  private readonly elements = new Map<string, Element>();
  private readonly slotClocks = new Map<string, SyncClock>();
  private readonly tombstoneElementIds = new Set<string>();
  private readonly processedRequests = new Map<string, SyncRoomProcessedRequest>();
  private documentClock: SyncClock;
  private roomEpoch: SyncClock;
  private readonly planner: SyncRoomPlanner;
  private unhealthy = false;
  private recoveryTail: Promise<void> = Promise.resolve();

  constructor(private readonly options: SyncRoomOptions) {
    for (const element of options.elements ?? []) {
      this.elements.set(element.id, element);
    }
    for (const slotClock of options.slotClocks ?? []) {
      this.slotClocks.set(toSlotClockKey(slotClock.elementId, slotClock.slot), slotClock.clock);
    }
    for (const elementId of options.tombstoneElementIds ?? []) {
      this.tombstoneElementIds.add(elementId);
    }
    this.documentClock = options.documentClock ?? 0;
    this.roomEpoch = options.roomEpoch ?? 0;
    this.planner = options.planner ?? defaultSyncRoomPlanner;
  }

  execute(
    command: SharedSyncCommand,
    actorContext: SyncRoomActorContext,
  ): Promise<SyncRoomCommitOutcome> {
    if (command.roomId !== this.options.roomId) {
      throw new Error(`Room mismatch: ${command.roomId} !== ${this.options.roomId}.`);
    }

    return this.actor
      .enqueue(() => this.executeCriticalSection(command, actorContext))
      .then(async ({ result, afterApply, replayed }) => {
        if (afterApply) {
          await this.enqueueOutput(() => afterApply(result.changeSet));
        }
        return { ...result, replayed };
      });
  }

  getStateSnapshot(): SyncRoomStateSnapshot {
    return {
      elements: new Map(this.elements),
      documentClock: this.documentClock,
      roomEpoch: this.roomEpoch,
      slotClocks: new Map(this.slotClocks),
      tombstoneElementIds: new Set(this.tombstoneElementIds),
      processedRequests: new Map(
        [...this.processedRequests.entries()].map(([key, processed]) => [key, processed.result]),
      ),
    };
  }

  private async executeCriticalSection(
    command: SharedSyncCommand,
    actorContext: SyncRoomActorContext,
  ): Promise<SyncRoomCriticalSectionResult> {
    await this.ensureHealthy();

    const idempotencyKey = toProcessedRequestKey(actorContext.actorId, command.requestId);
    const payloadHash = toCommandPayloadHash(command);
    const persistencePolicy = resolveSyncCommandPersistencePolicy(command);
    const processed = this.processedRequests.get(idempotencyKey);
    if (processed) {
      if (processed.payloadHash !== payloadHash) {
        throw new SyncRoomCommandError('DUPLICATE_REQUEST_CONFLICT');
      }
      return { result: processed.result, replayed: true };
    }

    if (persistencePolicy.storeProcessedRequest && this.options.persistence) {
      const persisted = await this.options.persistence.findProcessedRequest({
        roomId: this.options.roomId,
        actorId: actorContext.actorId,
        requestId: command.requestId,
      });
      if (persisted) {
        if (persisted.payloadHash !== payloadHash) {
          throw new SyncRoomCommandError('DUPLICATE_REQUEST_CONFLICT');
        }
        this.processedRequests.set(idempotencyKey, persisted);
        return { result: persisted.result, replayed: true };
      }
    }

    assertCanMutate(actorContext);
    const serverClock = this.documentClock + 1;
    const plan = await this.planner({
      command,
      actorContext,
      state: this.getStateSnapshot(),
      serverClock,
      referenceValidator: this.options.referenceValidator,
    });
    const changeSet = createChangeSet(command, actorContext, serverClock, this.roomEpoch, plan);
    assertChangeSetWithinLimit(changeSet, this.options.maxChangeSetBytes ?? MAX_CHANGESET_BYTES);

    const result: SyncRoomExecutionResult = {
      command,
      actorId: actorContext.actorId,
      changeSet,
    };

    try {
      if (this.options.persistence) {
        await this.options.persistence.commitChangeSet({
          command,
          actorId: actorContext.actorId,
          payloadHash,
          expectedDocumentClock: this.documentClock,
          result,
          policy: persistencePolicy,
          slotClocks: this.previewSlotClocks(changeSet),
        });
      } else {
        await plan.commit?.();
      }
    } catch (error) {
      if (isConditionalClockConflict(error)) {
        await this.recoverUnhealthy(error);
        throw new SyncRoomCommandError(
          'ROOM_UNHEALTHY',
          'Conditional room clock update failed; room was reloaded.',
        );
      }
      throw error;
    }

    try {
      this.applyCommitted(changeSet);
    } catch (error) {
      if (this.options.persistence) {
        await this.recoverUnhealthy(error);
        throw new SyncRoomCommandError(
          'ROOM_UNHEALTHY',
          'Committed change set could not be applied to hot room state; room was reloaded.',
        );
      }
      throw error;
    }

    if (persistencePolicy.storeProcessedRequest) {
      this.processedRequests.set(idempotencyKey, { payloadHash, result });
    }
    return { result, replayed: false, afterApply: plan.afterApply };
  }

  private applyCommitted(changeSet: CommittedChangeSet): void {
    this.documentClock = changeSet.serverClock;
    this.roomEpoch = changeSet.roomEpoch;

    for (const element of changeSet.created) {
      this.elements.set(element.id, element);
      this.tombstoneElementIds.delete(element.id);
    }
    for (const patched of changeSet.patched) {
      this.elements.set(patched.elementId, patched.element);
    }
    for (const elementId of changeSet.deleted) {
      this.elements.delete(elementId);
      this.tombstoneElementIds.add(elementId);
    }
    for (const slotClock of changeSet.slotClocks) {
      this.slotClocks.set(toSlotClockKey(slotClock.elementId, slotClock.slot), slotClock.clock);
    }
  }

  private previewSlotClocks(changeSet: CommittedChangeSet): ReadonlyMap<string, SyncClock> {
    const slotClocks = new Map(this.slotClocks);
    for (const slotClock of changeSet.slotClocks) {
      slotClocks.set(toSlotClockKey(slotClock.elementId, slotClock.slot), slotClock.clock);
    }
    return slotClocks;
  }

  private enqueueOutput(task: () => void | Promise<void>): Promise<void> {
    const run = this.outputTail.catch(() => undefined).then(task);
    this.outputTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async ensureHealthy(): Promise<void> {
    if (!this.unhealthy) return;
    await this.recoveryTail;
    if (this.unhealthy) {
      throw new SyncRoomCommandError('ROOM_UNHEALTHY');
    }
  }

  private async recoverUnhealthy(cause: unknown): Promise<void> {
    this.unhealthy = true;
    this.recoveryTail = this.recoveryTail
      .catch(() => undefined)
      .then(async () => {
        if (!this.options.persistence) {
          throw cause instanceof Error ? cause : new Error(String(cause));
        }
        const state = await this.options.persistence.reloadState({ roomId: this.options.roomId });
        this.rebuildHotIndexes(state);
        this.unhealthy = false;
      });
    await this.recoveryTail;
  }

  private rebuildHotIndexes(state: SyncRoomReloadState): void {
    this.elements.clear();
    for (const element of state.elements) {
      this.elements.set(element.id, element);
    }

    this.slotClocks.clear();
    for (const slotClock of state.slotClocks) {
      this.slotClocks.set(toSlotClockKey(slotClock.elementId, slotClock.slot), slotClock.clock);
    }

    this.tombstoneElementIds.clear();
    for (const elementId of state.tombstoneElementIds ?? []) {
      this.tombstoneElementIds.add(elementId);
    }

    this.processedRequests.clear();
    for (const [key, processed] of state.processedRequests ?? []) {
      this.processedRequests.set(key, processed);
    }

    this.documentClock = state.documentClock;
    this.roomEpoch = state.roomEpoch;
  }
}

function assertCanMutate(actorContext: SyncRoomActorContext): void {
  if (actorContext.effectiveRole === 'viewer' || actorContext.effectiveRole === 'none') {
    throw new SyncRoomCommandError('FORBIDDEN');
  }
}

function toProcessedRequestKey(actorId: string | null, requestId: string): string {
  return `${actorId ?? 'anonymous'}:${requestId}`;
}
