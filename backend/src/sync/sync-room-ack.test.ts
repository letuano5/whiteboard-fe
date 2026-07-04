import type { PatchSlotsCommand, SlotPatch } from '@vdt/shared';
import { SYNC_PROTOCOL_VERSION, SYNC_SCHEMA_VERSION } from '@vdt/shared';
import { describe, expect, it } from 'vitest';
import { makeElement } from '../test/element-fixtures.js';
import { createSyncAck, createSyncRejectAck } from './sync-room-ack.js';
import { SyncRoom } from './sync-room.js';
import { SyncRoomCommandError } from './sync-room-errors.js';

describe('P5-05 SyncRoom change-set ACK helpers', () => {
  it('creates canonical change-set metadata and a commit ACK for clean patches', async () => {
    const room = new SyncRoom({ roomId: 'room-1', elements: [makeElement({ id: 'shape' })] });

    const result = await room.execute(
      patchCommand('patch-clean', [
        {
          elementId: 'shape',
          slot: 'style.fillColor',
          baseClock: 0,
          changes: { fillColor: '#ff0000' },
        },
      ]),
      { actorId: 'actor-1', effectiveRole: 'editor' },
    );
    const ack = createSyncAck(result);

    expect(ack.status).toBe('commit');
    expect(ack.requestId).toBe('patch-clean');
    expect(ack.serverClock).toBe(1);
    expect(result.changeSet).toMatchObject({
      originActorId: 'actor-1',
      originRequestIds: ['patch-clean'],
      reason: 'patch_clean',
      deletes: [],
      puts: [],
      slotPatches: [
        expect.objectContaining({
          elementId: 'shape',
          slot: 'style.fillColor',
          clock: 1,
          changes: { fillColor: '#ff0000' },
        }),
      ],
    });
  });

  it('creates a rebase ACK when latest-to-server conflict resolution was used', async () => {
    const room = new SyncRoom({
      roomId: 'room-1',
      elements: [makeElement({ id: 'shape' })],
      slotClocks: [{ elementId: 'shape', slot: 'transform.position', clock: 2 }],
      documentClock: 2,
    });

    const result = await room.execute(
      patchCommand('stale-move', [
        {
          elementId: 'shape',
          slot: 'transform.position',
          baseClock: 1,
          changes: { x: 10, y: 20 },
        },
      ]),
      { actorId: 'actor-1', effectiveRole: 'editor' },
    );
    const ack = createSyncAck(result);

    expect(result.changeSet.reason).toBe('patch_lww_conflict');
    expect(ack.status).toBe('rebase');
    expect(ack).toMatchObject({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      requestId: 'stale-move',
      serverClock: 3,
    });
  });

  it('creates reject ACKs with protocol metadata and command error reason', () => {
    const command = patchCommand('bad-request', []);

    const ack = createSyncRejectAck(command, new SyncRoomCommandError('STALE_CLIENT_STATE'), 4);

    expect(ack).toEqual({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId: 'room-1',
      requestId: 'bad-request',
      serverClock: 4,
      status: 'reject',
      reason: 'STALE_CLIENT_STATE',
    });
  });
});

function patchCommand(requestId: string, patches: SlotPatch[]): PatchSlotsCommand {
  return {
    kind: 'patch-slots',
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId: 'room-1',
    requestId,
    clientClock: 1,
    baseRoomEpoch: 0,
    patches,
  };
}
