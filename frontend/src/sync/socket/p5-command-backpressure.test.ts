import { describe, expect, it } from 'vitest';
import type { PatchSlotsCommand } from '../../types/shared';
import { SYNC_PROTOCOL_VERSION, SYNC_SCHEMA_VERSION } from '../../types/shared';
import { compactQueuedSyncCommands, enqueueCoalescedPatch } from './p5-command-backpressure';
import type { QueuedSyncCommand } from './state';

const DURABLE_PERSISTENCE: PatchSlotsCommand['persistence'] = {
  durability: 'durable',
  resendable: true,
  storeProcessedRequest: true,
};

const TRANSIENT_PERSISTENCE: PatchSlotsCommand['persistence'] = {
  durability: 'relaxed',
  transient: true,
  resendable: false,
  storeProcessedRequest: false,
};

function makePatchQueued(
  requestId: string,
  createdAt: number,
  persistence: PatchSlotsCommand['persistence'],
  x: number,
): QueuedSyncCommand {
  const command: PatchSlotsCommand = {
    kind: 'patch-slots',
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId: 'room-1',
    requestId,
    clientClock: createdAt,
    baseRoomEpoch: 0,
    persistence,
    patches: [
      { elementId: 'shape-1', slot: 'transform.position', baseClock: 0, changes: { x, y: 0 } },
    ],
  };
  return { command, sendAfter: createdAt, createdAt };
}

describe('enqueueCoalescedPatch durability merging', () => {
  it('never downgrades a queued durable patch when a transient patch arrives for the same slot', () => {
    // @covers L5
    const queue = enqueueCoalescedPatch([], makePatchQueued('final-1', 0, DURABLE_PERSISTENCE, 10));
    const merged = enqueueCoalescedPatch(
      queue,
      makePatchQueued('preview-1', 10, TRANSIENT_PERSISTENCE, 20),
    );

    expect(merged).toHaveLength(1);
    const command = merged[0]!.command as PatchSlotsCommand;
    expect(command.persistence).toMatchObject({ durability: 'durable', resendable: true });
    expect(command.patches[0]?.changes).toEqual({ x: 20, y: 0 });
  });

  it('upgrades a queued transient patch to durable when a final patch arrives for the same slot', () => {
    // @covers L5
    const queue = enqueueCoalescedPatch(
      [],
      makePatchQueued('preview-1', 0, TRANSIENT_PERSISTENCE, 10),
    );
    const merged = enqueueCoalescedPatch(
      queue,
      makePatchQueued('final-1', 10, DURABLE_PERSISTENCE, 20),
    );

    expect(merged).toHaveLength(1);
    const command = merged[0]!.command as PatchSlotsCommand;
    expect(command.persistence).toMatchObject({ durability: 'durable', resendable: true });
    expect(command.patches[0]?.changes).toEqual({ x: 20, y: 0 });
  });

  it('keeps transient when both coalesced patches are transient', () => {
    const queue = enqueueCoalescedPatch(
      [],
      makePatchQueued('preview-1', 0, TRANSIENT_PERSISTENCE, 10),
    );
    const merged = enqueueCoalescedPatch(
      queue,
      makePatchQueued('preview-2', 10, TRANSIENT_PERSISTENCE, 20),
    );

    const command = merged[0]!.command as PatchSlotsCommand;
    expect(command.persistence).toMatchObject({ durability: 'relaxed', transient: true });
  });
});

describe('compactQueuedSyncCommands durability merging', () => {
  it('never downgrades a durable patch when compacting with an overlapping transient patch', () => {
    // @covers L5
    const durable = makePatchQueued('final-1', 0, DURABLE_PERSISTENCE, 10);
    const transient = makePatchQueued('preview-1', 10, TRANSIENT_PERSISTENCE, 20);

    const compacted = compactQueuedSyncCommands([durable, transient]);

    expect(compacted).toHaveLength(1);
    const command = compacted[0]!.command as PatchSlotsCommand;
    expect(command.persistence).toMatchObject({ durability: 'durable', resendable: true });
    expect(command.patches[0]?.changes).toEqual({ x: 20, y: 0 });
  });
});
