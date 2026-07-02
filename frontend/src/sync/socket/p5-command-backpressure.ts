import type { QueuedSyncCommand } from './state';

export function enqueueCoalescedPatch(
  queue: QueuedSyncCommand[],
  next: QueuedSyncCommand,
): QueuedSyncCommand[] {
  if (next.command.kind !== 'patch-slots') return [...queue, next];
  let updatedQueue = [...queue];

  for (const patch of next.command.patches) {
    let coalesced = false;
    updatedQueue = updatedQueue.map((queued) => {
      if (queued.command.kind !== 'patch-slots') return queued;
      const patches = queued.command.patches.map((existing) => {
        if (existing.elementId !== patch.elementId || existing.slot !== patch.slot) return existing;
        coalesced = true;
        return {
          ...patch,
          inverseChanges: existing.inverseChanges ?? patch.inverseChanges,
        };
      });
      return { ...queued, command: { ...queued.command, patches } };
    });
    if (!coalesced) {
      updatedQueue = [...updatedQueue, { ...next, command: { ...next.command, patches: [patch] } }];
    }
  }

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
  for (const patch of queued.command.patches) {
    const existing = compacted.find(
      (entry) =>
        entry.command.kind === 'patch-slots' &&
        entry.command.patches.some(
          (candidate) => candidate.elementId === patch.elementId && candidate.slot === patch.slot,
        ),
    );
    if (!existing) {
      compacted.push({ ...queued, command: { ...queued.command, patches: [patch] } });
      continue;
    }
    if (existing.command.kind !== 'patch-slots') continue;
    existing.command.patches = existing.command.patches.map((candidate) =>
      candidate.elementId === patch.elementId && candidate.slot === patch.slot
        ? { ...patch, inverseChanges: candidate.inverseChanges ?? patch.inverseChanges }
        : candidate,
    );
  }
}
