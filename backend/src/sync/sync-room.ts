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
import { toPayloadHash } from './sync-room-payload-hash.js';
import { defaultSyncRoomPlanner } from './sync-room-planner.js';
import type {
  SyncRoomActorContext,
  SyncRoomCommitOutcome,
  SyncRoomExecutionResult,
  SyncRoomPlanner,
  SyncRoomReferenceValidator,
  SyncRoomStateSnapshot,
} from './sync-room-contracts.js';

export type {
  SyncRoomActorContext,
  SyncRoomCommitOutcome,
  SyncRoomExecutionResult,
  SyncRoomPlan,
  SyncRoomPlanner,
  SyncRoomPlannerContext,
  SyncRoomReferenceValidator,
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
  private readonly processedRequests = new Map<string, SyncRoomExecutionResult>();
  private documentClock: SyncClock;
  private roomEpoch: SyncClock;
  private readonly planner: SyncRoomPlanner;

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
      processedRequests: new Map(this.processedRequests),
    };
  }

  private async executeCriticalSection(
    command: SharedSyncCommand,
    actorContext: SyncRoomActorContext,
  ): Promise<SyncRoomCriticalSectionResult> {
    const idempotencyKey = toProcessedRequestKey(actorContext.actorId, command.requestId);
    const processed = this.processedRequests.get(idempotencyKey);
    if (processed) {
      if (toPayloadHash(processed.command) !== toPayloadHash(command)) {
        throw new SyncRoomCommandError('DUPLICATE_REQUEST_CONFLICT');
      }
      return { result: processed, replayed: true };
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

    await plan.commit?.();
    this.applyCommitted(changeSet);

    const result: SyncRoomExecutionResult = {
      command,
      actorId: actorContext.actorId,
      changeSet,
    };
    this.processedRequests.set(idempotencyKey, result);
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

  private enqueueOutput(task: () => void | Promise<void>): Promise<void> {
    const run = this.outputTail.catch(() => undefined).then(task);
    this.outputTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
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
