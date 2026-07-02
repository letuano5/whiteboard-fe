import type {
  ChangeSetReason,
  CommittedChangeSet,
  SlotClockUpdate,
  SlotPatch,
  SyncClock,
  SyncCommand as SharedSyncCommand,
} from '@vdt/shared';
import { SYNC_PROTOCOL_VERSION, SYNC_SCHEMA_VERSION } from '@vdt/shared';
import { SyncRoomCommandError } from './sync-room-errors.js';
import type { SyncRoomActorContext, SyncRoomPlan } from './sync-room-contracts.js';

export function toSlotClockKey(elementId: string, slot: string): string {
  return `${elementId}:${slot}`;
}

export function assertChangeSetWithinLimit(changeSet: CommittedChangeSet, maxBytes: number): void {
  if (Buffer.byteLength(JSON.stringify(changeSet), 'utf8') > maxBytes) {
    throw new SyncRoomCommandError('TOO_LARGE');
  }
}

export function createChangeSet(
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
  const reason = plan.reason ?? inferChangeSetReason(command);

  return {
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId: command.roomId,
    requestId: command.requestId,
    serverClock,
    roomEpoch: plan.roomEpoch ?? roomEpoch,
    originActorId: actorContext.actorId,
    originRequestIds: [command.requestId],
    reason,
    slotPatches,
    puts: reason === 'create' || reason === 'replace_document' ? created : [],
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
