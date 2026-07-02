import {
  SYNC_PROTOCOL_VERSION,
  SYNC_SCHEMA_VERSION,
  type Element,
  type ReplaceDocumentCommand,
  type SyncSlot,
} from '@vdt/shared';
import { describe, expect, it } from 'vitest';
import { makeElement } from '../test/element-fixtures.js';
import { SyncRoom } from './sync-room.js';
import { SyncRoomCommandError } from './sync-room-errors.js';

describe('SyncRoom replace-document', () => {
  it('replaces the document, tombstones absent current ids, and bumps roomEpoch', async () => {
    // @covers AC-1
    // @covers AC-2
    const oldA = makeElement({ id: 'old-a' });
    const oldB = makeElement({ id: 'old-b' });
    const replacement = makeElement({ id: 'replacement' });
    const room = new SyncRoom({
      roomId: 'room-1',
      elements: [oldA, oldB],
      documentClock: 10,
      roomEpoch: 3,
    });

    const result = await room.execute(createReplaceCommand('replace-1', [replacement], 3), {
      actorId: 'user-1',
    });
    const snapshot = room.getStateSnapshot();

    expect(result.changeSet).toEqual(
      expect.objectContaining({
        reason: 'replace_document',
        serverClock: 11,
        roomEpoch: 4,
        deleted: ['old-a', 'old-b'],
        puts: [expect.objectContaining({ id: 'replacement' })],
      }),
    );
    expect(snapshot.elements.has('old-a')).toBe(false);
    expect(snapshot.elements.has('old-b')).toBe(false);
    expect(snapshot.elements.get('replacement')).toEqual(
      expect.objectContaining({ id: 'replacement' }),
    );
    expect(snapshot.tombstoneElementIds.has('old-a')).toBe(true);
    expect(snapshot.tombstoneElementIds.has('old-b')).toBe(true);
    expect(snapshot.roomEpoch).toBe(4);
  });

  it('rejects commands with a stale baseRoomEpoch after a replace', async () => {
    // @covers AC-3
    const room = new SyncRoom({
      roomId: 'room-1',
      elements: [makeElement({ id: 'old' })],
      roomEpoch: 2,
    });

    await expect(
      room.execute(createReplaceCommand('replace-stale', [makeElement({ id: 'next' })], 1), {
        actorId: 'user-1',
      }),
    ).rejects.toMatchObject(new SyncRoomCommandError('STALE_ROOM_EPOCH'));
    expect(room.getStateSnapshot().elements.has('old')).toBe(true);
    expect(room.getStateSnapshot().roomEpoch).toBe(2);
  });

  it('rebuilds slot clocks from scratch when the same id is replaced with a different type', async () => {
    // @covers AC-5
    const original = makeElement({ id: 'same-id', type: 'rectangle' });
    const replacement = makeElement({ id: 'same-id', type: 'text' });
    const room = new SyncRoom({
      roomId: 'room-1',
      elements: [original],
      documentClock: 20,
      roomEpoch: 1,
      slotClocks: [
        { elementId: 'same-id', slot: 'transform.position', clock: 3 },
        { elementId: 'same-id', slot: 'legacy.slot' as SyncSlot, clock: 99 },
      ],
    });

    await room.execute(createReplaceCommand('replace-same-id', [replacement], 1), {
      actorId: 'user-1',
    });
    const snapshot = room.getStateSnapshot();

    expect(snapshot.elements.get('same-id')).toEqual(expect.objectContaining({ type: 'text' }));
    expect(snapshot.slotClocks.get('same-id:legacy.slot')).toBeUndefined();
    expect(snapshot.slotClocks.get('same-id:transform.position')).toBe(21);
  });
});

function createReplaceCommand(
  requestId: string,
  elements: Element[],
  baseRoomEpoch: number,
): ReplaceDocumentCommand {
  return {
    kind: 'replace-document',
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId: 'room-1',
    requestId,
    clientClock: 1,
    baseRoomEpoch,
    elements,
    reason: 'import',
  };
}
