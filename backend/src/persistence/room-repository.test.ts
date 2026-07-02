/**
 * Unit tests for room-repository.ts
 * Uses a deep mock of PrismaClient to avoid real database connections.
 *
 * saveRoomElements tests:
 * @covers AC-1 Room and active record written on first element save.
 * @covers AC-2 documentClock increments exactly once; all records share recordClock.
 * @covers AC-3 Deleted element removes active record and creates tombstone.
 * @covers AC-4 Later non-deleted element for tombstoned id upserts record and clears tombstone.
 * @covers AC-9 Empty batch performs no DB writes and does not increment documentClock.
 *
 * loadRoomElements tests:
 * @covers AC-1 (P3A-02) DB load on join — elements and clock returned for room with active records.
 * @covers AC-3 (P3A-02) Empty room (no DB data) returns { elements: [], documentClock: 0, slotClocks: [] }.
 * @covers AC-6 (P3A-02) All records deleted (tombstones only) returns { elements: [], documentClock: N, slotClocks: [] }.
 * @covers AC-8 (P3A-02) documentClock is number in socket payload.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  saveRoomElements,
  loadRoomElements,
  getRoomClock,
  getRoomDiff,
} from './room-repository.js';
import { makeElement, makeDeletedElement } from '../test/element-fixtures.js';
import type { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Prisma mock helpers — write path (saveRoomElements)
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
  const roomFindUnique = vi.fn().mockResolvedValue({ documentClock: clockToReturn });
  const roomUpdate = makeRoomUpdate(clockToReturn);
  const recordUpsert = makeRecordUpsert();
  const recordDeleteMany = makeRecordDeleteMany();
  const tombstoneUpsert = makeTombstoneUpsert();
  const tombstoneDeleteMany = makeTombstoneDeleteMany();

  const tx = {
    room: { upsert: roomUpsert, findUnique: roomFindUnique, update: roomUpdate },
    record: { upsert: recordUpsert, deleteMany: recordDeleteMany },
    tombstone: { upsert: tombstoneUpsert, deleteMany: tombstoneDeleteMany },
  };

  type FakeTx = typeof tx;

  // $transaction executes the callback with `tx` and returns whatever it returns
  const $transaction = vi.fn().mockImplementation((cb: (t: FakeTx) => unknown) => cb(tx));

  const db = {
    $transaction,
    room: { upsert: roomUpsert, findUnique: roomFindUnique, update: roomUpdate },
    record: { upsert: recordUpsert, deleteMany: recordDeleteMany },
    tombstone: { upsert: tombstoneUpsert, deleteMany: tombstoneDeleteMany },
  } as unknown as PrismaClient;

  return {
    db,
    tx,
    roomUpsert,
    roomFindUnique,
    roomUpdate,
    recordUpsert,
    recordDeleteMany,
    tombstoneUpsert,
    tombstoneDeleteMany,
    $transaction,
  };
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
      const elements = [
        makeElement({ id: 'el-1' }),
        makeElement({ id: 'el-2' }),
        makeElement({ id: 'el-3' }),
      ];
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

    it('uses the live targetDocumentClock for all active recordClock values', async () => {
      // @covers AC-2
      const targetDocumentClock = 42;
      const elements = [makeElement({ id: 'target-el-A' }), makeElement({ id: 'target-el-B' })];
      const { db, recordUpsert } = buildMockDb(BigInt(targetDocumentClock));

      await saveRoomElements(db, ROOM_ID, elements, targetDocumentClock);

      for (const call of recordUpsert.mock.calls) {
        const arg = call[0] as {
          create: { recordClock: bigint };
          update: { recordClock: bigint };
        };
        expect(arg.create.recordClock).toEqual(42n);
        expect(arg.update.recordClock).toEqual(42n);
      }
    });

    it('uses the live targetDocumentClock for tombstone deletedClock values', async () => {
      // @covers AC-2
      const targetDocumentClock = 43;
      const deleted = makeDeletedElement({ id: 'target-del' });
      const { db, tombstoneUpsert } = buildMockDb(BigInt(targetDocumentClock));

      await saveRoomElements(db, ROOM_ID, [deleted], targetDocumentClock);

      expect(tombstoneUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ deletedClock: 43n }),
          update: expect.objectContaining({ deletedClock: 43n }),
        }),
      );
    });

    it('does not decrease Room.documentClock when the database clock is already higher than target', async () => {
      const { db, roomUpdate } = buildMockDb(50n);

      await saveRoomElements(db, ROOM_ID, [makeElement({ id: 'lower-target-el' })], 40);

      expect(roomUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: { documentClock: 40n },
        }),
      );
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
          create: expect.objectContaining({
            roomId: ROOM_ID,
            recordId: 'el-del',
            deletedClock: 2n,
          }),
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

  // =========================================================================
  // P5-13A — slotClocksMap written when provided
  // =========================================================================
  describe('P5-13A: slotClocksMap written when provided', () => {
    it('includes slotClocks in record upsert when slotClocksMap is provided', async () => {
      const el = makeElement({ id: 'el-slot' });
      const { db, recordUpsert } = buildMockDb(1n);
      const slotClocksMap = new Map([
        ['el-slot', { 'transform.position': { clock: 1 }, 'style.fillColor': { clock: 1 } }],
      ]);

      await saveRoomElements(db, ROOM_ID, [el], undefined, slotClocksMap);

      expect(recordUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            slotClocks: { 'transform.position': { clock: 1 }, 'style.fillColor': { clock: 1 } },
          }),
          update: expect.objectContaining({
            slotClocks: { 'transform.position': { clock: 1 }, 'style.fillColor': { clock: 1 } },
          }),
        }),
      );
    });

    it('uses empty slotClocks {} when no slotClocksMap entry for element', async () => {
      const el = makeElement({ id: 'el-no-slot' });
      const { db, recordUpsert } = buildMockDb(1n);

      await saveRoomElements(db, ROOM_ID, [el]);

      expect(recordUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ slotClocks: {} }),
        }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Prisma mock helpers — read path (loadRoomElements, getRoomClock)
// ---------------------------------------------------------------------------

/**
 * Build a minimal Prisma mock for the read path.
 * `findUniqueFn` is the mock for `db.room.findUnique`.
 */
function buildReadMockDb(findUniqueFn: ReturnType<typeof vi.fn>) {
  const db = {
    room: {
      findUnique: findUniqueFn,
    },
  } as unknown as PrismaClient;
  return db;
}

// ---------------------------------------------------------------------------
// loadRoomElements
// ---------------------------------------------------------------------------

describe('loadRoomElements', () => {
  const ROOM_ID = 'room-load-test';

  // =========================================================================
  // @covers AC-1 (P3A-02) — DB load on join with active records
  // =========================================================================
  describe('AC-1 (P3A-02): room with active records', () => {
    it('returns elements deserialized from record.state and correct documentClock', async () => {
      const el = makeElement({ id: 'el-load-1' });
      const findUnique = vi.fn().mockResolvedValue({
        id: ROOM_ID,
        documentClock: 7n,
        roomEpoch: 2n,
        records: [
          {
            roomId: ROOM_ID,
            recordId: 'el-load-1',
            typeName: 'rectangle',
            state: el,
            recordClock: 7n,
            slotClocks: {},
          },
        ],
        tombstones: [],
      });
      const db = buildReadMockDb(findUnique);

      const result = await loadRoomElements(db, ROOM_ID);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0]).toEqual(el);
      expect(result.documentClock).toBe(7);
      expect(result.roomEpoch).toBe(2);
      expect(result.slotClocks).toEqual([]);
      expect(result.tombstoneElementIds).toEqual([]);
    });

    it('extracts slotClocks from record.slotClocks JSON', async () => {
      const el = makeElement({ id: 'el-clocked' });
      const findUnique = vi.fn().mockResolvedValue({
        id: ROOM_ID,
        documentClock: 3n,
        roomEpoch: 0n,
        records: [
          {
            roomId: ROOM_ID,
            recordId: 'el-clocked',
            typeName: 'rectangle',
            state: el,
            recordClock: 3n,
            slotClocks: {
              'transform.position': { clock: 3, lastActorId: 'user-1' },
              'style.fillColor': { clock: 2 },
            },
          },
        ],
        tombstones: [{ roomId: ROOM_ID, recordId: 'deleted-shape', deletedClock: 2n }],
      });
      const db = buildReadMockDb(findUnique);

      const result = await loadRoomElements(db, ROOM_ID);

      expect(result.slotClocks).toHaveLength(2);
      expect(result.slotClocks).toContainEqual({
        elementId: 'el-clocked',
        slot: 'transform.position',
        clock: 3,
      });
      expect(result.slotClocks).toContainEqual({
        elementId: 'el-clocked',
        slot: 'style.fillColor',
        clock: 2,
      });
      expect(result.tombstoneElementIds).toEqual(['deleted-shape']);
    });

    it('queries with records and tombstones for P5 recovery', async () => {
      const findUnique = vi.fn().mockResolvedValue(null);
      const db = buildReadMockDb(findUnique);

      await loadRoomElements(db, ROOM_ID);

      expect(findUnique).toHaveBeenCalledWith({
        where: { id: ROOM_ID },
        include: { records: true, tombstones: true },
      });
    });
  });

  // =========================================================================
  // @covers AC-3 (P3A-02) — Empty room (no DB data)
  // =========================================================================
  describe('AC-3 (P3A-02): room does not exist in DB', () => {
    it('returns empty recovery state when room is not found', async () => {
      const findUnique = vi.fn().mockResolvedValue(null);
      const db = buildReadMockDb(findUnique);

      const result = await loadRoomElements(db, ROOM_ID);

      expect(result).toEqual({
        elements: [],
        documentClock: 0,
        roomEpoch: 0,
        slotClocks: [],
        tombstoneElementIds: [],
      });
    });
  });

  // =========================================================================
  // @covers AC-6 (P3A-02) — All records tombstoned (room exists, records: [])
  // =========================================================================
  describe('AC-6 (P3A-02): room exists but all records are tombstoned', () => {
    it('returns { elements: [], documentClock: N, slotClocks: [] } where N > 0', async () => {
      const findUnique = vi.fn().mockResolvedValue({
        id: ROOM_ID,
        documentClock: 42n,
        roomEpoch: 4n,
        records: [],
        tombstones: [{ roomId: ROOM_ID, recordId: 'deleted-only', deletedClock: 42n }],
      });
      const db = buildReadMockDb(findUnique);

      const result = await loadRoomElements(db, ROOM_ID);

      expect(result.elements).toHaveLength(0);
      expect(result.documentClock).toBe(42);
      expect(result.documentClock).toBeGreaterThan(0);
      expect(result.roomEpoch).toBe(4);
      expect(result.slotClocks).toEqual([]);
      expect(result.tombstoneElementIds).toEqual(['deleted-only']);
    });
  });

  // =========================================================================
  // @covers AC-8 (P3A-02) — documentClock is number, not bigint
  // =========================================================================
  describe('AC-8 (P3A-02): documentClock is a JavaScript number', () => {
    it('documentClock in result is typeof "number" (not bigint)', async () => {
      const findUnique = vi.fn().mockResolvedValue({
        id: ROOM_ID,
        documentClock: 99n,
        roomEpoch: 0n,
        records: [],
        tombstones: [],
      });
      const db = buildReadMockDb(findUnique);

      const result = await loadRoomElements(db, ROOM_ID);

      expect(typeof result.documentClock).toBe('number');
    });

    it('documentClock equals the numeric value of the stored BigInt', async () => {
      const findUnique = vi.fn().mockResolvedValue({
        id: ROOM_ID,
        documentClock: 5n,
        roomEpoch: 0n,
        records: [],
        tombstones: [],
      });
      const db = buildReadMockDb(findUnique);

      const result = await loadRoomElements(db, ROOM_ID);

      // Confirm the numeric value is correct after BigInt→number conversion
      expect(result.documentClock).toBe(5);
    });

    it('throws when documentClock exceeds the safe wire number range', async () => {
      const findUnique = vi.fn().mockResolvedValue({
        id: ROOM_ID,
        documentClock: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
        roomEpoch: 0n,
        records: [],
        tombstones: [],
      });
      const db = buildReadMockDb(findUnique);

      await expect(loadRoomElements(db, ROOM_ID)).rejects.toThrow(
        'Clock value exceeds Number.MAX_SAFE_INTEGER.',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// getRoomClock
// ---------------------------------------------------------------------------

describe('getRoomClock', () => {
  const ROOM_ID = 'room-clock-test';

  it('returns the documentClock as number when room exists', async () => {
    const findUnique = vi.fn().mockResolvedValue({ documentClock: 13n });
    const db = buildReadMockDb(findUnique);

    const clock = await getRoomClock(db, ROOM_ID);

    expect(clock).toBe(13);
    expect(typeof clock).toBe('number');
  });

  it('returns 0 when room does not exist', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const db = buildReadMockDb(findUnique);

    const clock = await getRoomClock(db, ROOM_ID);

    expect(clock).toBe(0);
  });

  it('queries with select: { documentClock: true } only', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const db = buildReadMockDb(findUnique);

    await getRoomClock(db, ROOM_ID);

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: ROOM_ID },
      select: { documentClock: true },
    });
  });
});

// ---------------------------------------------------------------------------
// getRoomDiff — P3A-03 reconnect diff query
// ---------------------------------------------------------------------------

/**
 * Builds a Prisma mock for the getRoomDiff read path.
 * Supports: tombstone.aggregate, room.findUnique, record.findMany, tombstone.findMany.
 * changedRecords now include slotClocks for P5-13A slot-aware diff.
 */
function buildDiffMockDb({
  minDeletedClock,
  documentClock,
  roomEpoch = 0n,
  changedRecords,
  deletedTombstones,
  allRecords,
}: {
  minDeletedClock: bigint | null;
  documentClock: bigint;
  roomEpoch?: bigint;
  changedRecords: Array<{
    recordId: string;
    state: unknown;
    recordClock: bigint;
    slotClocks: Record<string, { clock: number }>;
  }>;
  deletedTombstones: Array<{ recordId: string }>;
  allRecords?: Array<{
    recordId: string;
    state: unknown;
    recordClock: bigint;
    slotClocks: Record<string, { clock: number }>;
  }>;
}) {
  const tombstoneAggregate = vi.fn().mockResolvedValue({
    _min: { deletedClock: minDeletedClock },
  });
  const roomFindUnique = vi.fn().mockResolvedValue({ documentClock, roomEpoch });
  // Wipe path calls record.findMany once (all records, no clock filter).
  // Diff path calls record.findMany once (filtered by recordClock).
  // Use allRecords when provided (wipe scenario), changedRecords otherwise (diff scenario).
  const recordFindMany = vi
    .fn()
    .mockResolvedValue(allRecords !== undefined ? allRecords : changedRecords);
  const tombstoneFindMany = vi.fn().mockResolvedValue(deletedTombstones);

  const db = {
    $transaction: (task: (tx: unknown) => unknown) => task(db),
    tombstone: {
      aggregate: tombstoneAggregate,
      findMany: tombstoneFindMany,
    },
    room: {
      findUnique: roomFindUnique,
    },
    record: {
      findMany: recordFindMany,
    },
  } as unknown as PrismaClient;

  return { db, tombstoneAggregate, roomFindUnique, recordFindMany, tombstoneFindMany };
}

describe('getRoomDiff — P3A-03', () => {
  const ROOM_ID = 'room-diff-test';

  // =========================================================================
  // @covers AC-10 — no tombstones → always diff mode (never wipe-all)
  // =========================================================================
  describe('AC-10: no tombstones in room → incremental diff always returned', () => {
    it('returns mode=diff when there are no tombstones (min deletedClock = null)', async () => {
      const el = makeElement({ id: 'el-1' });
      const { db } = buildDiffMockDb({
        minDeletedClock: null, // no tombstones
        documentClock: 5n,
        changedRecords: [{ recordId: 'el-1', state: el, recordClock: 3n, slotClocks: {} }],
        deletedTombstones: [],
      });

      const result = await getRoomDiff(db, ROOM_ID, 2, []);

      expect(result.mode).toBe('diff');
      if (result.mode === 'diff') {
        expect(result.changed).toHaveLength(1);
        expect(result.deleted).toHaveLength(0);
        expect(result.documentClock).toBe(5);
        expect(result.slotClocks).toEqual([]);
      }
    });

    it('returns diff with empty changed and deleted when client is fully up-to-date', async () => {
      // @covers AC-10 (edge case: zero changes)
      const { db } = buildDiffMockDb({
        minDeletedClock: null,
        documentClock: 7n,
        changedRecords: [],
        deletedTombstones: [],
      });

      const result = await getRoomDiff(db, ROOM_ID, 7, []);

      expect(result.mode).toBe('diff');
      if (result.mode === 'diff') {
        expect(result.changed).toHaveLength(0);
        expect(result.deleted).toHaveLength(0);
        expect(result.documentClock).toBe(7);
        expect(result.slotClocks).toEqual([]);
      }
    });
  });

  // =========================================================================
  // @covers AC-1 — changed records returned for valid lastServerClock
  // =========================================================================
  describe('AC-1: changed records since lastServerClock are included in diff', () => {
    it('returns only records with recordClock > lastServerClock', async () => {
      const el1 = makeElement({ id: 'changed-1' });
      const { db } = buildDiffMockDb({
        minDeletedClock: null,
        documentClock: 10n,
        changedRecords: [{ recordId: 'changed-1', state: el1, recordClock: 8n, slotClocks: {} }],
        deletedTombstones: [],
      });

      const result = await getRoomDiff(db, ROOM_ID, 5, []);

      expect(result.mode).toBe('diff');
      if (result.mode === 'diff') {
        expect(result.changed.map((e) => e.id)).toContain('changed-1');
      }
    });
  });

  // =========================================================================
  // @covers AC-2 — deleted tombstones returned in diff
  // =========================================================================
  describe('AC-2: tombstones after lastServerClock are returned in deleted list', () => {
    it('returns deleted IDs for tombstones with deletedClock > lastServerClock', async () => {
      const { db } = buildDiffMockDb({
        minDeletedClock: 3n, // history starts at 3, lastServerClock=3 → 3 >= 3 → diff mode
        documentClock: 10n,
        changedRecords: [],
        deletedTombstones: [{ recordId: 'del-el-1' }, { recordId: 'del-el-2' }],
      });

      const result = await getRoomDiff(db, ROOM_ID, 3, []);

      expect(result.mode).toBe('diff');
      if (result.mode === 'diff') {
        expect(result.deleted.map((d) => d.id)).toEqual(['del-el-1', 'del-el-2']);
      }
    });
  });

  // =========================================================================
  // @covers AC-8 — wipe-all when lastServerClock < MIN(deletedClock)
  // =========================================================================
  describe('AC-8: wipe-all returned when tombstone history is insufficient', () => {
    it('returns mode=wipe when lastServerClock=5 and MIN(deletedClock)=8', async () => {
      const el1 = makeElement({ id: 'active-1' });
      const elDeleted = makeDeletedElement({ id: 'ghost' });
      const { db } = buildDiffMockDb({
        minDeletedClock: 8n, // history starts at 8
        documentClock: 12n,
        changedRecords: [],
        deletedTombstones: [],
        allRecords: [{ recordId: 'active-1', state: el1, recordClock: 12n, slotClocks: {} }],
      });

      const result = await getRoomDiff(db, ROOM_ID, 5, [el1, elDeleted]);

      expect(result.mode).toBe('wipe');
      if (result.mode === 'wipe') {
        // Only active elements included in wipe snapshot
        expect(result.elements.map((e) => e.id)).toContain('active-1');
        expect(result.elements.map((e) => e.id)).not.toContain('ghost');
        expect(result.documentClock).toBe(12);
        expect(result.slotClocks).toEqual([]);
      }
    });

    it('does NOT hit record findMany for diff queries in wipe path', async () => {
      const { db, recordFindMany } = buildDiffMockDb({
        minDeletedClock: 8n,
        documentClock: 12n,
        changedRecords: [],
        deletedTombstones: [],
        allRecords: [],
      });

      await getRoomDiff(db, ROOM_ID, 5, []);

      // wipe path queries all records (for slotClocks), but does NOT call
      // the filtered changedRecords query or tombstone findMany
      expect(recordFindMany).toHaveBeenCalledTimes(1);
    });

    it('does NOT hit tombstone findMany in wipe path', async () => {
      const { db, tombstoneFindMany } = buildDiffMockDb({
        minDeletedClock: 8n,
        documentClock: 12n,
        changedRecords: [],
        deletedTombstones: [],
        allRecords: [],
      });

      await getRoomDiff(db, ROOM_ID, 5, []);

      expect(tombstoneFindMany).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // P5: persisted room diff reads from DB truth only, not the in-memory mirror
  // =========================================================================
  describe('P5 persisted diff excludes in-memory overlay', () => {
    it('does not include in-memory active elements not present in DB changed set', async () => {
      const dbEl = makeElement({ id: 'db-el' });
      const memEl = makeElement({ id: 'mem-only-el' });

      const { db } = buildDiffMockDb({
        minDeletedClock: null,
        documentClock: 6n,
        changedRecords: [{ recordId: 'db-el', state: dbEl, recordClock: 4n, slotClocks: {} }],
        deletedTombstones: [],
      });

      const result = await getRoomDiff(db, ROOM_ID, 2, [dbEl, memEl]);

      expect(result.mode).toBe('diff');
      if (result.mode === 'diff') {
        const ids = result.changed.map((e) => e.id);
        expect(ids).toContain('db-el');
        expect(ids).not.toContain('mem-only-el');
        // db-el should appear only once (not duplicated from overlay)
        expect(ids.filter((id) => id === 'db-el')).toHaveLength(1);
      }
    });

    it('does NOT include deleted in-memory elements in overlay', async () => {
      const delMemEl = makeDeletedElement({ id: 'mem-deleted-el' });

      const { db } = buildDiffMockDb({
        minDeletedClock: null,
        documentClock: 4n,
        changedRecords: [],
        deletedTombstones: [],
      });

      const result = await getRoomDiff(db, ROOM_ID, 0, [delMemEl]);

      expect(result.mode).toBe('diff');
      if (result.mode === 'diff') {
        expect(result.changed.map((e) => e.id)).not.toContain('mem-deleted-el');
      }
    });
  });

  describe('P5 roomEpoch boundary', () => {
    it('returns wipe when the client roomEpoch does not match the server roomEpoch', async () => {
      const el = makeElement({ id: 'active-epoch' });
      const { db } = buildDiffMockDb({
        minDeletedClock: null,
        documentClock: 12n,
        roomEpoch: 3n,
        changedRecords: [],
        deletedTombstones: [],
        allRecords: [{ recordId: 'active-epoch', state: el, recordClock: 12n, slotClocks: {} }],
      });

      const result = await getRoomDiff(db, ROOM_ID, 11, [], { roomEpoch: 2 });

      expect(result.mode).toBe('wipe');
      if (result.mode === 'wipe') {
        expect(result.roomEpoch).toBe(3);
        expect(result.elements.map((element) => element.id)).toEqual(['active-epoch']);
      }
    });
  });

  // =========================================================================
  // documentClock is always a number (BigInt conversion at boundary)
  // =========================================================================
  describe('documentClock type conversion', () => {
    it('documentClock is typeof number in diff result', async () => {
      const { db } = buildDiffMockDb({
        minDeletedClock: null,
        documentClock: 99n,
        changedRecords: [],
        deletedTombstones: [],
      });

      const result = await getRoomDiff(db, ROOM_ID, 0, []);
      expect(typeof result.documentClock).toBe('number');
      expect(result.documentClock).toBe(99);
    });

    it('documentClock is typeof number in wipe result', async () => {
      const { db } = buildDiffMockDb({
        minDeletedClock: 10n,
        documentClock: 55n,
        changedRecords: [],
        deletedTombstones: [],
        allRecords: [],
      });

      const result = await getRoomDiff(db, ROOM_ID, 3, []);
      expect(result.mode).toBe('wipe');
      expect(typeof result.documentClock).toBe('number');
      expect(result.documentClock).toBe(55);
    });
  });

  // =========================================================================
  // P5-13A — slot-aware 2-step diff filter
  // =========================================================================
  describe('P5-13A: slot-aware 2-step diff filter', () => {
    it('returns only slot clocks with clock > lastServerClock from changed records', async () => {
      // @covers AC-6
      const el = makeElement({ id: 'patched-el' });
      const { db } = buildDiffMockDb({
        minDeletedClock: null,
        documentClock: 5n,
        changedRecords: [
          {
            recordId: 'patched-el',
            state: el,
            recordClock: 5n,
            slotClocks: {
              'transform.position': { clock: 5 },
              'style.fillColor': { clock: 2 }, // NOT > lastServerClock=3
            },
          },
        ],
        deletedTombstones: [],
      });

      const result = await getRoomDiff(db, ROOM_ID, 3, []);

      expect(result.mode).toBe('diff');
      if (result.mode === 'diff') {
        expect(result.slotClocks).toHaveLength(1);
        expect(result.slotClocks[0]).toEqual({
          elementId: 'patched-el',
          slot: 'transform.position',
          clock: 5,
        });
      }
    });

    it('returns slotClocks: [] when no slots changed since lastServerClock', async () => {
      const el = makeElement({ id: 'stale-el' });
      const { db } = buildDiffMockDb({
        minDeletedClock: null,
        documentClock: 10n,
        changedRecords: [
          {
            recordId: 'stale-el',
            state: el,
            recordClock: 10n,
            slotClocks: {
              'transform.position': { clock: 3 }, // NOT > lastServerClock=5
            },
          },
        ],
        deletedTombstones: [],
      });

      const result = await getRoomDiff(db, ROOM_ID, 5, []);

      expect(result.mode).toBe('diff');
      if (result.mode === 'diff') {
        expect(result.slotClocks).toEqual([]);
      }
    });

    it('returns all slot clocks in wipe mode (sinceServerClock=0)', async () => {
      const el = makeElement({ id: 'wipe-el' });
      const allRecords = [
        {
          recordId: 'wipe-el',
          state: el,
          recordClock: 5n,
          slotClocks: {
            'transform.position': { clock: 5 },
            'style.fillColor': { clock: 3 },
          },
        },
      ];
      const { db } = buildDiffMockDb({
        minDeletedClock: 8n,
        documentClock: 12n,
        changedRecords: [],
        deletedTombstones: [],
        allRecords,
      });

      const result = await getRoomDiff(db, ROOM_ID, 5, [el]);

      expect(result.mode).toBe('wipe');
      if (result.mode === 'wipe') {
        expect(result.slotClocks).toHaveLength(2);
        expect(result.slotClocks).toContainEqual({
          elementId: 'wipe-el',
          slot: 'transform.position',
          clock: 5,
        });
        expect(result.slotClocks).toContainEqual({
          elementId: 'wipe-el',
          slot: 'style.fillColor',
          clock: 3,
        });
      }
    });
  });
});
