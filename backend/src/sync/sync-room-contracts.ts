import type {
  CommittedChangeSet,
  EffectiveRoomRole,
  Element,
  SlotClockUpdate,
  SyncCommand as SharedSyncCommand,
  SyncClock,
  SyncOrderEntry,
  ChangeSetReason,
} from '@vdt/shared';

export type SyncRoomActorContext = {
  actorId: string | null;
  effectiveRole?: EffectiveRoomRole;
};

export interface SyncRoomExecutionResult {
  command: SharedSyncCommand;
  actorId: string | null;
  changeSet: CommittedChangeSet;
}

export type SyncRoomCommitOutcome = SyncRoomExecutionResult & {
  /** True when the command was an idempotent replay of an already-processed request. */
  replayed: boolean;
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

export interface SyncRoomReferenceValidator {
  canUseAssetSrc?: (src: string, actorContext: SyncRoomActorContext) => boolean;
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
