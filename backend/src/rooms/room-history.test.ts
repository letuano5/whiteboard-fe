import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WS_EVENTS, type Element } from '@vdt/shared';
import { makeElement } from '../test/element-fixtures.js';
import { executeReplaceDocument } from '../sync/index.js';
import { loadRoomForOwnerAction, resolveRoomAccess, RoomAccessError } from './room-roles.js';
import {
  captureIntervalSnapshotForCommit,
  captureRoomSnapshot,
  type RoomSnapshotDb,
} from './room-snapshots.js';
import { listRoomSnapshots, restoreRoomSnapshot } from './room-history.js';

vi.mock('../sync/index.js', () => ({
  deleteSyncRoom: vi.fn(),
  executeReplaceDocument: vi.fn().mockResolvedValue({
    kind: 'replace-document',
    roomId: 'room-1',
    replacedElementCount: 1,
    documentClock: '8',
    roomEpoch: 3,
    changeSet: {},
    replacePayload: {
      protocolVersion: 1,
      schemaVersion: 1,
      roomId: 'room-1',
      serverClock: 8,
      roomEpoch: 3,
      elements: [],
      slotClocks: [],
    },
  }),
}));

vi.mock('./room-roles.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./room-roles.js')>();
  return {
    ...actual,
    loadRoomForOwnerAction: vi.fn().mockResolvedValue(makeOwnerRoomAccessRecord()),
    resolveRoomAccess: vi.fn().mockResolvedValue({ roomId: 'room-1', effectiveRole: 'viewer' }),
  };
});

const owner = {
  id: 'owner-1',
  provider: 'test',
  providerSubject: 'owner-1',
  email: 'owner@example.com',
  name: null,
  avatarUrl: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const snapshotElement = makeElement({ id: 'snapshot-shape' });

beforeEach(() => {
  vi.mocked(executeReplaceDocument).mockClear();
  vi.mocked(loadRoomForOwnerAction).mockReset();
  vi.mocked(loadRoomForOwnerAction).mockResolvedValue(makeOwnerRoomAccessRecord());
  vi.mocked(resolveRoomAccess).mockClear();
});

describe('room history snapshots', () => {
  it('lists snapshot metadata for users who can access the saved room', async () => {
    // @covers AC-1
    const { db, snapshotFindMany } = buildHistoryDb();

    await expect(listRoomSnapshots(db, 'room-1', owner)).resolves.toEqual([
      {
        id: 'snap-1',
        documentClock: '7',
        roomEpoch: 2,
        createdBy: 'owner-1',
        createdAt: '2026-07-03T03:00:00.000Z',
        reason: 'interval',
      },
    ]);

    expect(resolveRoomAccess).toHaveBeenCalledWith(db, 'room-1', owner);
    expect(snapshotFindMany).toHaveBeenCalledWith({
      where: { roomId: 'room-1' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: expect.objectContaining({ id: true, documentClock: true }),
    });
  });

  it('creates interval snapshots only after the 30s threshold and advanced clock', async () => {
    // @covers AC-5
    const latestCreatedAt = new Date('2026-07-03T03:00:00.000Z');
    const { db, snapshotCreate, snapshotFindFirst } = buildHistoryDb({
      latestSnapshot: { createdAt: latestCreatedAt, documentClock: 3n },
    });
    const commit = makeCommit(7);

    await expect(
      captureIntervalSnapshotForCommit(db, commit, {
        now: new Date('2026-07-03T03:00:29.999Z'),
      }),
    ).resolves.toBeNull();
    expect(snapshotCreate).not.toHaveBeenCalled();

    await captureIntervalSnapshotForCommit(db, commit, {
      now: new Date('2026-07-03T03:00:30.000Z'),
    });

    expect(snapshotFindFirst).toHaveBeenCalledWith({
      where: { roomId: 'room-1' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, documentClock: true },
    });
    expect(snapshotCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        roomId: 'room-1',
        documentClock: 7n,
        reason: 'interval',
        records: [snapshotElement],
      }),
      select: { id: true },
    });
  });

  it('captures safety snapshot and restores through SyncRoom replace without direct row mutation', async () => {
    // @covers AC-2
    // @covers AC-3
    // @covers AC-6
    // @covers AC-8
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    const { db, snapshotCreate, recordDeleteMany, tombstoneDeleteMany } = buildHistoryDb();

    await expect(
      restoreRoomSnapshot(
        {
          db,
          ioServer: { to } as never,
          syncRooms: new Map(),
        },
        { roomId: 'room-1', snapshotId: 'snap-1', user: owner },
      ),
    ).resolves.toEqual({
      documentClock: '8',
      roomEpoch: 3,
      restoredElementCount: 1,
    });

    expect(snapshotCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ reason: 'restore_safety', records: [snapshotElement] }),
      select: { id: true },
    });
    expect(executeReplaceDocument).toHaveBeenCalledWith(
      {
        roomId: 'room-1',
        elements: [snapshotElement],
        reason: 'restore',
      },
      expect.objectContaining({ actorId: 'owner-1', effectiveRole: 'owner' }),
    );
    expect(recordDeleteMany).not.toHaveBeenCalled();
    expect(tombstoneDeleteMany).not.toHaveBeenCalled();
    expect(to).toHaveBeenCalledWith('room-1');
    expect(emit).toHaveBeenCalledWith(WS_EVENTS.ROOM_REPLACED, expect.any(Object));
  });

  it('rejects non-owner restore before loading or replacing snapshot records', async () => {
    // @covers AC-7
    const { db, snapshotFindUnique } = buildHistoryDb();
    vi.mocked(loadRoomForOwnerAction).mockRejectedValueOnce(
      new RoomAccessError('room-access/forbidden', 'Only room owners can change roles.'),
    );

    await expect(
      restoreRoomSnapshot({ db }, { roomId: 'room-1', snapshotId: 'snap-1', user: owner }),
    ).rejects.toThrow('Only room owners can change roles.');

    expect(snapshotFindUnique).not.toHaveBeenCalled();
    expect(executeReplaceDocument).not.toHaveBeenCalled();
  });

  it('stores import safety snapshots from persisted server truth', async () => {
    // @covers AC-6
    const { db, snapshotCreate } = buildHistoryDb();

    await captureRoomSnapshot(db, {
      roomId: 'room-1',
      reason: 'import_safety',
      createdBy: 'owner-1',
    });

    expect(snapshotCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        roomId: 'room-1',
        reason: 'import_safety',
        records: [snapshotElement],
        tombstones: [{ recordId: 'deleted-1', deletedClock: '5' }],
      }),
      select: { id: true },
    });
  });
});

function buildHistoryDb(
  options: {
    latestSnapshot?: { createdAt: Date; documentClock: bigint } | null;
    records?: Element[];
  } = {},
) {
  const records = options.records ?? [snapshotElement];
  const roomFindUnique = vi.fn().mockResolvedValue({
    documentClock: 7n,
    roomEpoch: 2n,
    records: records.map((state) => ({ state })),
    tombstones: [{ recordId: 'deleted-1', deletedClock: 5n }],
  });
  const snapshotCreate = vi.fn().mockResolvedValue({ id: 'created-snapshot' });
  const snapshotFindFirst = vi
    .fn()
    .mockResolvedValue(options.latestSnapshot ?? { createdAt: new Date(0), documentClock: 0n });
  const snapshotFindMany = vi.fn().mockResolvedValue([
    {
      id: 'snap-1',
      documentClock: 7n,
      roomEpoch: 2n,
      createdBy: 'owner-1',
      createdAt: new Date('2026-07-03T03:00:00.000Z'),
      reason: 'interval',
      records,
      tombstones: [],
    },
  ]);
  const snapshotFindUnique = vi.fn().mockResolvedValue({
    id: 'snap-1',
    roomId: 'room-1',
    documentClock: 7n,
    roomEpoch: 2n,
    createdBy: 'owner-1',
    createdAt: new Date('2026-07-03T03:00:00.000Z'),
    reason: 'interval',
    records: [snapshotElement],
    tombstones: [],
  });
  const recordDeleteMany = vi.fn();
  const tombstoneDeleteMany = vi.fn();
  const db = {
    room: { findUnique: roomFindUnique },
    snapshot: {
      create: snapshotCreate,
      findFirst: snapshotFindFirst,
      findMany: snapshotFindMany,
      findUnique: snapshotFindUnique,
    },
    record: { deleteMany: recordDeleteMany },
    tombstone: { deleteMany: tombstoneDeleteMany },
  } as unknown as RoomSnapshotDb &
    Parameters<typeof listRoomSnapshots>[0] &
    Parameters<typeof restoreRoomSnapshot>[0]['db'];

  return {
    db,
    roomFindUnique,
    snapshotCreate,
    snapshotFindFirst,
    snapshotFindMany,
    snapshotFindUnique,
    recordDeleteMany,
    tombstoneDeleteMany,
  };
}

function makeCommit(serverClock: number) {
  return {
    actorId: 'actor-1',
    result: {
      changeSet: {
        roomId: 'room-1',
        serverClock,
      },
    },
  } as Parameters<typeof captureIntervalSnapshotForCommit>[1];
}

function makeOwnerRoomAccessRecord() {
  return {
    id: 'room-1',
    name: 'Room 1',
    workspaceId: null,
    ownerId: 'owner-1',
    visibility: 'private',
    shareRevokedAt: null,
    locked: false,
    maxParticipants: null,
    maxEditors: null,
    archivedAt: null,
    lastOpenedAt: null,
    createdBy: 'owner-1',
    documentClock: 0n,
    roomEpoch: 0n,
    tombstoneHistoryStartsAtClock: 0n,
    processedRequestHistoryStartsAtClock: 0n,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    members: [],
    invitations: [],
  };
}
