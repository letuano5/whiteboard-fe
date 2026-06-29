/**
 * Unit tests for room-repository.ts
 * Uses a deep mock of PrismaClient to avoid real database connections.
 *
 * @covers AC-1 Room and active record written on first element save.
 * @covers AC-2 documentClock increments exactly once; all records share recordClock.
 * @covers AC-3 Deleted element removes active record and creates tombstone.
 * @covers AC-4 Later non-deleted element for tombstoned id upserts record and clears tombstone.
 * @covers AC-9 Empty batch performs no DB writes and does not increment documentClock.
 */

import { describe, it, expect, vi } from 'vitest';
import { saveRoomElements } from './room-repository.js';
import { makeElement, makeDeletedElement } from '../test/element-fixtures.js';
import type { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Prisma mock helpers
// ---------------------------------------------------------------------------

function makeRoomUpsert() {
  return vi.fn().mockResolvedValue({});
}

function makeRoomUpdate(returnClock: bigint) {
  return vi.fn().mockResolvedValue({ documentClock: returnClock });
}

function makeRecordUpsert() {
  return vi.fn().mockResolvedValue({});
}

function makeRecordDeleteMany() {
  return vi.fn().mockResolvedValue({ count: 0 });
}

function makeTombstoneUpsert() {
  return vi.fn().mockResolvedValue({});
}

function makeTombstoneDeleteMany() {
  return vi.fn().mockResolvedValue({ count: 0 });
}

/**
 * Builds a fake Prisma client whose `$transaction` executes the callback
 * immediately with the provided inner tx object.
 */
function buildMockDb(clockToReturn: bigint = 1n) {
  const roomUpsert = makeRoomUpsert();
  const roomUpdate = makeRoomUpdate(clockToReturn);
  const recordUpsert = makeRecordUpsert();
  const recordDeleteMany = makeRecordDeleteMany();
  const tombstoneUpsert = makeTombstoneUpsert();
  const tombstoneDeleteMany = makeTombstoneDeleteMany();

  const tx = {
    room: { upsert: roomUpsert, update: roomUpdate },
    record: { upsert: recordUpsert, deleteMany: recordDeleteMany },
    tombstone: { upsert: tombstoneUpsert, deleteMany: tombstoneDeleteMany },
  };

  type FakeTx = typeof tx;

  // $transaction executes the callback with `tx` and returns whatever it returns
  const $transaction = vi.fn().mockImplementation((cb: (t: FakeTx) => unknown) => cb(tx));

  const db = {
    $transaction,
    room: { upsert: roomUpsert, update: roomUpdate },
    record: { upsert: recordUpsert, deleteMany: recordDeleteMany },
    tombstone: { upsert: tombstoneUpsert, deleteMany: tombstoneDeleteMany },
  } as unknown as PrismaClient;

  return { db, tx, roomUpsert, roomUpdate, recordUpsert, recordDeleteMany, tombstoneUpsert, tombstoneDeleteMany, $transaction };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('saveRoomElements', () => {
  const ROOM_ID = 'room-abc';

  // =========================================================================
  // @covers AC-9 — empty batch
  // =========================================================================
  describe('AC-9: empty batch', () => {
    it('returns null and performs no writes when elements array is empty', async () => {
      const { db, $transaction } = buildMockDb();

      const result = await saveRoomElements(db, ROOM_ID, []);

      expect(result).toBeNull();
      // No transaction should be opened
      expect($transaction).not.toHaveBeenCalled();
    });

    it('does not increment documentClock for a clean/empty room flush', async () => {
      const { db, roomUpdate } = buildMockDb();

      await saveRoomElements(db, ROOM_ID, []);

      expect(roomUpdate).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // @covers AC-1 — room creation and active record on first save
  // =========================================================================
  describe('AC-1: room creation and active record save', () => {
    it('upserts the Room row before writing element records', async () => {
      const el = makeElement({ id: 'el-1' });
      const { db, roomUpsert } = buildMockDb(1n);

      await saveRoomElements(db, ROOM_ID, [el]);

      expect(roomUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ROOM_ID },
          create: expect.objectContaining({ id: ROOM_ID }),
        }),
      );
    });

    it('upserts an active Record containing the full element state', async () => {
      const el = makeElement({ id: 'el-1', type: 'rectangle' });
      const { db, recordUpsert } = buildMockDb(1n);

      await saveRoomElements(db, ROOM_ID, [el]);

      expect(recordUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roomId_recordId: { roomId: ROOM_ID, recordId: 'el-1' } },
          create: expect.objectContaining({
            roomId: ROOM_ID,
            recordId: 'el-1',
            typeName: 'rectangle',
          }),
        }),
      );
    });

    it('returns the new documentClock', async () => {
      const el = makeElement({ id: 'el-1' });
      const { db } = buildMockDb(1n);

      const result = await saveRoomElements(db, ROOM_ID, [el]);

      expect(result).toEqual({ documentClock: 1n });
    });
  });

  // =========================================================================
  // @covers AC-2 — clock increments exactly once; all records share same clock
  // =========================================================================
  describe('AC-2: documentClock increments once; shared recordClock', () => {
    it('increments documentClock exactly once regardless of batch size', async () => {
      const elements = [makeElement({ id: 'el-1' }), makeElement({ id: 'el-2' }), makeElement({ id: 'el-3' })];
      const { db, roomUpdate } = buildMockDb(3n);

      await saveRoomElements(db, ROOM_ID, elements);

      expect(roomUpdate).toHaveBeenCalledTimes(1);
      expect(roomUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { documentClock: { increment: 1n } },
        }),
      );
    });

    it('assigns the same recordClock (= new documentClock) to all records in the batch', async () => {
      const clock = 5n;
      const elements = [makeElement({ id: 'el-A' }), makeElement({ id: 'el-B' })];
      const { db, recordUpsert } = buildMockDb(clock);

      await saveRoomElements(db, ROOM_ID, elements);

      // Both upserts should carry the same recordClock
      for (const call of recordUpsert.mock.calls) {
        const arg = call[0] as { create: { recordClock: bigint } };
        expect(arg.create.recordClock).toEqual(clock);
      }
    });
  });

  // =========================================================================
  // @covers AC-3 — deleted element: remove record, create tombstone
  // =========================================================================
  describe('AC-3: deleted element creates tombstone and removes active record', () => {
    it('deletes the active record for the element', async () => {
      const el = makeDeletedElement({ id: 'el-del' });
      const { db, recordDeleteMany } = buildMockDb(2n);

      await saveRoomElements(db, ROOM_ID, [el]);

      expect(recordDeleteMany).toHaveBeenCalledWith({
        where: { roomId: ROOM_ID, recordId: 'el-del' },
      });
    });

    it('upserts a tombstone with the transaction clock', async () => {
      const el = makeDeletedElement({ id: 'el-del' });
      const { db, tombstoneUpsert } = buildMockDb(2n);

      await saveRoomElements(db, ROOM_ID, [el]);

      expect(tombstoneUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roomId_recordId: { roomId: ROOM_ID, recordId: 'el-del' } },
          create: expect.objectContaining({ roomId: ROOM_ID, recordId: 'el-del', deletedClock: 2n }),
        }),
      );
    });

    it('does not upsert a Record for a deleted element', async () => {
      const el = makeDeletedElement({ id: 'el-del' });
      const { db, recordUpsert } = buildMockDb(2n);

      await saveRoomElements(db, ROOM_ID, [el]);

      expect(recordUpsert).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // @covers AC-4 — later non-deleted update for tombstoned element
  // =========================================================================
  describe('AC-4: later active update clears tombstone and upserts record', () => {
    it('upserts the active Record', async () => {
      const el = makeElement({ id: 'el-revived' });
      const { db, recordUpsert } = buildMockDb(3n);

      await saveRoomElements(db, ROOM_ID, [el]);

      expect(recordUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roomId_recordId: { roomId: ROOM_ID, recordId: 'el-revived' } },
        }),
      );
    });

    it('deletes any matching tombstone for that element id', async () => {
      const el = makeElement({ id: 'el-revived' });
      const { db, tombstoneDeleteMany } = buildMockDb(3n);

      await saveRoomElements(db, ROOM_ID, [el]);

      expect(tombstoneDeleteMany).toHaveBeenCalledWith({
        where: { roomId: ROOM_ID, recordId: 'el-revived' },
      });
    });

    it('does not create a tombstone for a non-deleted element', async () => {
      const el = makeElement({ id: 'el-revived' });
      const { db, tombstoneUpsert } = buildMockDb(3n);

      await saveRoomElements(db, ROOM_ID, [el]);

      expect(tombstoneUpsert).not.toHaveBeenCalled();
    });
  });
});
