import type {
  ChangeSetReason,
  CommittedChangeSet,
  EffectiveRoomRole,
  Element,
  SlotPatch,
  SlotClockUpdate,
  SyncCommand as SharedSyncCommand,
  SyncClock,
  SyncOrderEntry,
} from '@vdt/shared';
import { SYNC_PROTOCOL_VERSION, SYNC_SCHEMA_VERSION } from '@vdt/shared';
import { RoomActor } from './room-actor.js';
import { SyncRoomCommandError } from './sync-room-errors.js';
import { MAX_CHANGESET_BYTES } from './sync-room-limits.js';
import { defaultSyncRoomPlanner } from './sync-room-planner.js';

export type SyncRoomActorContext = {
  actorId: string | null;
  effectiveRole?: EffectiveRoomRole;
};

export interface SyncRoomStateSnapshot {
  elements: ReadonlyMap<string, Element>;
  documentClock: SyncClock;
  roomEpoch: SyncClock;
  slotClocks: ReadonlyMap<string, SyncClock>;
  tombstoneElementIds: ReadonlySet<string>;
  processedRequests: ReadonlyMap<string, SyncRoomExecutionResult>;
}

export interface SyncRoomPlan {
  created?: Element[];
  patched?: CommittedChangeSet['patched'];
  deleted?: string[];
  slotClocks?: SlotClockUpdate[];
  normalizedOrder?: SyncOrderEntry[];
  roomEpoch?: SyncClock;
  reason?: ChangeSetReason;
  commit?: () => void | Promise<void>;
  afterApply?: (changeSet: CommittedChangeSet) => void | Promise<void>;
}

export interface SyncRoomPlannerContext {
  command: SharedSyncCommand;
  actorContext: SyncRoomActorContext;
  state: SyncRoomStateSnapshot;
  serverClock: SyncClock;
  referenceValidator?: SyncRoomReferenceValidator;
}

type MaybePromise<T> = T | Promise<T>;
export type SyncRoomPlanner = (context: SyncRoomPlannerContext) => MaybePromise<SyncRoomPlan>;

export interface SyncRoomExecutionResult {
  command: SharedSyncCommand;
  actorId: string | null;
  changeSet: CommittedChangeSet;
}

export interface SyncRoomReferenceValidator {
  canUseAssetSrc?: (src: string, actorContext: SyncRoomActorContext) => boolean;
}

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

export class SyncRoom {
  private readonly actor = new RoomActor();
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
  ): Promise<SyncRoomExecutionResult> {
    if (command.roomId !== this.options.roomId) {
      throw new Error(`Room mismatch: ${command.roomId} !== ${this.options.roomId}.`);
    }

    return this.actor.enqueue(() => this.executeCriticalSection(command, actorContext));
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
  ): Promise<SyncRoomExecutionResult> {
    const idempotencyKey = toProcessedRequestKey(actorContext.actorId, command.requestId);
    const processed = this.processedRequests.get(idempotencyKey);
    if (processed) return processed;

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
    await plan.afterApply?.(changeSet);

    const result: SyncRoomExecutionResult = {
      command,
      actorId: actorContext.actorId,
      changeSet,
    };
    this.processedRequests.set(idempotencyKey, result);
    return result;
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
}

function assertCanMutate(actorContext: SyncRoomActorContext): void {
  if (actorContext.effectiveRole === 'viewer' || actorContext.effectiveRole === 'none') {
    throw new SyncRoomCommandError('FORBIDDEN');
  }
}

function assertChangeSetWithinLimit(changeSet: CommittedChangeSet, maxBytes: number): void {
  if (JSON.stringify(changeSet).length > maxBytes) {
    throw new SyncRoomCommandError('TOO_LARGE');
  }
}

function createChangeSet(
  command: SharedSyncCommand,
  actorContext: SyncRoomActorContext,
  serverClock: SyncClock,
  roomEpoch: SyncClock,
  plan: SyncRoomPlan,
): CommittedChangeSet {
  const patched = plan.patched ?? [];
  const slotClocks = plan.slotClocks ?? [];
  const slotPatches = toCommittedSlotPatches(patched, slotClocks);
  const created = plan.created ?? [];
  const deleted = plan.deleted ?? [];

  return {
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId: command.roomId,
    requestId: command.requestId,
    serverClock,
    roomEpoch: plan.roomEpoch ?? roomEpoch,
    originActorId: actorContext.actorId,
    originRequestIds: [command.requestId],
    reason: plan.reason ?? inferChangeSetReason(command),
    slotPatches,
    puts: [...created, ...patched.map((entry) => entry.element)],
    deletes: deleted,
    created,
    patched,
    deleted,
    slotClocks,
    normalizedOrder: plan.normalizedOrder ?? [],
  };
}

function toCommittedSlotPatches(
  patched: CommittedChangeSet['patched'],
  slotClocks: SlotClockUpdate[],
): CommittedChangeSet['slotPatches'] {
  const clocks = new Map(
    slotClocks.map((slotClock) => [
      toSlotClockKey(slotClock.elementId, slotClock.slot),
      slotClock.clock,
    ]),
  );
  const slotPatches: Array<SlotPatch & { clock: SyncClock }> = [];
  for (const entry of patched) {
    for (const patch of entry.patches) {
      const clock = clocks.get(toSlotClockKey(patch.elementId, patch.slot));
      if (clock === undefined) continue;
      slotPatches.push({ ...patch, clock });
    }
  }
  return slotPatches;
}

function inferChangeSetReason(command: SharedSyncCommand): ChangeSetReason {
  switch (command.kind) {
    case 'create-element':
      return 'create';
    case 'patch-slots':
      return 'patch_clean';
    case 'delete-elements':
      return 'delete';
    case 'replace-document':
      return 'replace_document';
    case 'update-arrow-binding':
      return 'binding_update';
    default:
      return 'repair';
  }
}

function toProcessedRequestKey(actorId: string | null, requestId: string): string {
  return `${actorId ?? 'anonymous'}:${requestId}`;
}

function toSlotClockKey(elementId: string, slot: string): string {
  return `${elementId}:${slot}`;
}
