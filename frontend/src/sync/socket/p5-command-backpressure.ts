import type { QueuedSyncCommand } from './state';
import type { PatchSlotsCommand, SlotPatch } from '../../types/shared';

export function enqueueCoalescedPatch(
  queue: QueuedSyncCommand[],
  next: QueuedSyncCommand,
): QueuedSyncCommand[] {
  if (next.command.kind !== 'patch-slots') return [...queue, next];
  const mergeIndex = queue.findIndex(
    (queued) => queued.command.kind === 'patch-slots' && hasOverlappingPatch(queued, next),
  );
  const updatedQueue =
    mergeIndex === -1
      ? [...queue, next]
      : queue.map((queued, index) =>
          index === mergeIndex ? mergeQueuedPatchEnvelope(queued, next) : queued,
        );

  return updatedQueue.filter(
    (queued) => queued.command.kind !== 'patch-slots' || queued.command.patches.length > 0,
  );
}

export function compactQueuedSyncCommands(queue: QueuedSyncCommand[]): QueuedSyncCommand[] {
  const compacted: QueuedSyncCommand[] = [];
  for (const queued of queue) {
    if (queued.command.kind !== 'patch-slots') {
      compacted.push(queued);
      continue;
    }
    compactPatchCommand(compacted, queued);
  }
  return compacted;
}

function compactPatchCommand(compacted: QueuedSyncCommand[], queued: QueuedSyncCommand): void {
  if (queued.command.kind !== 'patch-slots') return;
  const existing = compacted.find(
    (entry) => entry.command.kind === 'patch-slots' && hasOverlappingPatch(entry, queued),
  );
  if (!existing) {
    compacted.push(queued);
    return;
  }
  const merged = mergeQueuedPatchEnvelope(existing, queued);
  Object.assign(existing, merged);
}

function mergeQueuedPatchEnvelope(
  queued: QueuedSyncCommand,
  next: QueuedSyncCommand,
): QueuedSyncCommand {
  if (queued.command.kind !== 'patch-slots' || next.command.kind !== 'patch-slots') return queued;
  const patches = mergePatches(queued.command.patches, next.command.patches);
  // A durable/final patch must never be downgraded to transient by coalescing with an
  // intermediate preview patch on either side — durability wins regardless of arrival order.
  const persistence = isDurablePatch(queued.command)
    ? queued.command.persistence
    : next.command.persistence;
  return {
    ...queued,
    command: { ...next.command, patches, persistence },
    dependsOnRequestId: queued.dependsOnRequestId ?? next.dependsOnRequestId,
    sendAfter: Math.min(queued.sendAfter, next.sendAfter),
    createdAt: Math.min(queued.createdAt, next.createdAt),
  };
}

function isDurablePatch(command: PatchSlotsCommand): boolean {
  return command.persistence?.durability !== 'relaxed';
}

function hasOverlappingPatch(left: QueuedSyncCommand, right: QueuedSyncCommand): boolean {
  if (left.command.kind !== 'patch-slots' || right.command.kind !== 'patch-slots') return false;
  const leftPatches = left.command.patches;
  const rightPatches = right.command.patches;
  return leftPatches.some((leftPatch) =>
    rightPatches.some(
      (rightPatch) =>
        rightPatch.elementId === leftPatch.elementId && rightPatch.slot === leftPatch.slot,
    ),
  );
}

function mergePatches(existingPatches: SlotPatch[], nextPatches: SlotPatch[]): SlotPatch[] {
  const merged = [...existingPatches];
  for (const patch of nextPatches) {
    const index = merged.findIndex(
      (candidate) => candidate.elementId === patch.elementId && candidate.slot === patch.slot,
    );
    if (index === -1) {
      merged.push(patch);
      continue;
    }
    const existing = merged[index];
    merged[index] = {
      ...patch,
      inverseChanges: existing?.inverseChanges ?? patch.inverseChanges,
    };
  }
  return merged;
}
