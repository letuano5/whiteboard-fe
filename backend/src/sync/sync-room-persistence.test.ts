import type {
  CreateElementCommand,
  DeleteElementsCommand,
  Element,
  PatchSlotsCommand,
  SyncCommand,
} from '@vdt/shared';
import { SYNC_PROTOCOL_VERSION, SYNC_SCHEMA_VERSION } from '@vdt/shared';
import { describe, expect, it, vi } from 'vitest';
import { makeElement } from '../test/element-fixtures.js';
import { SyncRoom, type SyncRoomPlan, type SyncRoomPlanner } from './sync-room.js';
import type {
  SyncRoomPersistence,
  SyncRoomPersistenceCommit,
  SyncRoomExecutionResult,
  SyncRoomProcessedRequest,
  SyncRoomReloadState,
} from './sync-room-contracts.js';
import {
  SyncRoomPersistenceError,
  createPrismaSyncRoomPersistence,
  resolveSyncCommandPersistencePolicy,
} from './sync-room-persistence.js';

describe('P5-06 SyncRoom transactional persistence and idempotency', () => {
  it('replays the same request and payload without increasing the clock', async () => {
    // @covers AC-1
    const persistence = new FakePersistence();
    const room = new SyncRoom({ roomId: 'room-1', persistence });
    const command = createCommand('request-1', makeElement({ id: 'shape' }));

    const first = await room.execute(command, { actorId: 'actor-1' });
    const replay = await room.execute(command, { actorId: 'actor-1' });

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.changeSet.serverClock).toBe(1);
    expect(room.getStateSnapshot().documentClock).toBe(1);
    expect(persistence.commits).toHaveLength(1);
  });

  it('rejects duplicate request IDs with different canonical payloads before planning', async () => {
    // @covers AC-2
    let plannerCalls = 0;
    const persistence = new FakePersistence();
    const room = new SyncRoom({
      roomId: 'room-1',
      persistence,
      planner: (context) => {
        plannerCalls += 1;
        return createPlan(context.command as CreateElementCommand);
      },
    });

    await room.execute(createCommand('request-1', makeElement({ id: 'first' })), {
      actorId: 'actor-1',
    });
    await expect(
      room.execute(createCommand('request-1', makeElement({ id: 'second' })), {
        actorId: 'actor-1',
      }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_REQUEST_CONFLICT' });

    expect(plannerCalls).toBe(1);
    expect(room.getStateSnapshot().documentClock).toBe(1);
  });

  it('does not run afterApply/broadcast work for duplicate replays', async () => {
    // @covers AC-3
    const afterApply = vi.fn();
    const persistence = new FakePersistence();
    const room = new SyncRoom({
      roomId: 'room-1',
      persistence,
      planner: (context) => ({
        ...createPlan(context.command as CreateElementCommand),
        afterApply,
      }),
    });
    const command = createCommand('request-1', makeElement({ id: 'shape' }));

    await room.execute(command, { actorId: 'actor-1' });
    await room.execute(command, { actorId: 'actor-1' });

    expect(afterApply).toHaveBeenCalledTimes(1);
  });

  it('replays a persisted processed request after hot memory is lost', async () => {
    // @covers AC-4
    const persistence = new FakePersistence();
    const command = createCommand('request-1', makeElement({ id: 'shape' }));
    await new SyncRoom({ roomId: 'room-1', persistence }).execute(command, { actorId: 'actor-1' });

    const restartedRoom = new SyncRoom({ roomId: 'room-1', persistence });
    const replay = await restartedRoom.execute(command, { actorId: 'actor-1' });

    expect(replay.replayed).toBe(true);
    expect(replay.changeSet.serverClock).toBe(1);
    expect(persistence.commits).toHaveLength(1);
  });

  it('commits a multi-delete and multi-repair change set with one documentClock increment', async () => {
    // @covers AC-5
    const persistence = new FakePersistence();
    const elements = [
      makeElement({ id: 'shape-1' }),
      makeElement({ id: 'shape-2' }),
      makeElement({ id: 'shape-3' }),
      ...Array.from({ length: 5 }, (_, index) =>
        makeElement({ id: `arrow-${index + 1}`, type: 'arrow' }),
      ),
    ];
    const planner: SyncRoomPlanner = ({ state, serverClock }) => ({
      deleted: ['shape-1', 'shape-2', 'shape-3'],
      patched: Array.from({ length: 5 }, (_, index) => {
        const elementId = `arrow-${index + 1}`;
        const element = state.elements.get(elementId)!;
        return {
          elementId,
          element: { ...element, props: { ...element.props, strokeColor: '#123456' } },
          patches: [
            {
              elementId,
              slot: 'style.strokeColor',
              baseClock: 0,
              changes: { strokeColor: '#123456' },
            },
          ],
        };
      }),
      slotClocks: Array.from({ length: 5 }, (_, index) => ({
        elementId: `arrow-${index + 1}`,
        slot: 'style.strokeColor',
        clock: serverClock,
      })),
      reason: 'repair',
    });
    const room = new SyncRoom({ roomId: 'room-1', elements, persistence, planner });

    const result = await room.execute(deleteCommand('repair-delete'), { actorId: 'actor-1' });

    expect(result.changeSet.serverClock).toBe(1);
    expect(result.changeSet.deleted).toHaveLength(3);
    expect(result.changeSet.patched).toHaveLength(5);
    expect(persistence.commits[0]?.expectedDocumentClock).toBe(0);
    expect(persistence.commits[0]?.result.changeSet.serverClock).toBe(1);
    expect(room.getStateSnapshot().documentClock).toBe(1);
  });

  it('writes touched records, tombstones, and slot clocks with the same documentClock', async () => {
    // @covers AC-5
    const tx = createFakePrismaTx();
    const persistence = createPrismaSyncRoomPersistence({
      processedRequest: tx.processedRequest,
      $transaction: async (task) => task(tx),
    });
    const element = makeElement({ id: 'shape', props: { ...makeElement().props, fillColor: '#fff' } });
    const command = patchCommand('patch-1');
    const result: SyncRoomExecutionResult = {
      command,
      actorId: 'actor-1',
      changeSet: {
        protocolVersion: SYNC_PROTOCOL_VERSION,
        schemaVersion: SYNC_SCHEMA_VERSION,
        roomId: 'room-1',
        requestId: 'patch-1',
        serverClock: 9,
        roomEpoch: 0,
        originActorId: 'actor-1',
        originRequestIds: ['patch-1'],
        reason: 'repair' as const,
        slotPatches: [],
        puts: [],
        deletes: ['deleted-shape'],
        created: [],
        patched: [
          {
            elementId: 'shape',
            element,
            patches: [
              {
                elementId: 'shape',
                slot: 'style.fillColor' as const,
                baseClock: 4,
                changes: { fillColor: '#fff' },
              },
            ],
          },
        ],
        deleted: ['deleted-shape'],
        slotClocks: [{ elementId: 'shape', slot: 'style.fillColor' as const, clock: 9 }],
        normalizedOrder: [],
      },
    };

    await persistence.commitChangeSet({
      command,
      actorId: 'actor-1',
      payloadHash: 'hash',
      expectedDocumentClock: 8,
      result,
      policy: { durability: 'durable', resendable: true, storeProcessedRequest: true },
      slotClocks: new Map([
        ['shape:transform.position', 3],
        ['shape:style.fillColor', 9],
      ]),
    });

    expect(tx.room.updateMany).toHaveBeenCalledWith({
      where: { id: 'room-1', documentClock: 8n },
      data: { documentClock: 9n, roomEpoch: 0n },
    });
    expect(tx.record.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          recordClock: 9n,
          slotClocks: expect.objectContaining({
            'transform.position': expect.objectContaining({ clock: 3 }),
            'style.fillColor': expect.objectContaining({ clock: 9, lastRequestId: 'patch-1' }),
          }),
        }),
        update: expect.objectContaining({
          recordClock: 9n,
          slotClocks: expect.objectContaining({
            'style.fillColor': expect.objectContaining({ clock: 9 }),
          }),
        }),
      }),
    );
    expect(tx.tombstone.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { roomId: 'room-1', recordId: 'deleted-shape', deletedClock: 9n },
        update: { deletedClock: 9n },
      }),
    );
  });

  it('does not mutate memory or run afterApply when DB commit fails', async () => {
    // @covers AC-6
    const afterApply = vi.fn();
    const persistence = new FakePersistence();
    persistence.failCommit = new Error('db unavailable');
    const room = new SyncRoom({
      roomId: 'room-1',
      persistence,
      planner: (context) => ({
        ...createPlan(context.command as CreateElementCommand),
        afterApply,
      }),
    });

    await expect(
      room.execute(createCommand('request-1', makeElement({ id: 'shape' })), {
        actorId: 'actor-1',
      }),
    ).rejects.toThrow('db unavailable');

    expect(room.getStateSnapshot().elements.size).toBe(0);
    expect(room.getStateSnapshot().documentClock).toBe(0);
    expect(afterApply).not.toHaveBeenCalled();
  });

  it('reloads persisted state after post-commit memory apply fails and then resumes', async () => {
    // @covers AC-7
    const persisted = makeElement({ id: 'persisted' });
    const persistence = new FakePersistence({
      reloadState: {
        elements: [persisted],
        documentClock: 7,
        roomEpoch: 0,
        slotClocks: [{ elementId: 'persisted', slot: 'transform.position', clock: 7 }],
      },
    });
    const room = new SyncRoom({ roomId: 'room-1', persistence });
    (room as unknown as { applyCommitted: () => void }).applyCommitted = () => {
      throw new Error('apply failed');
    };

    await expect(
      room.execute(createCommand('request-1', makeElement({ id: 'shape' })), {
        actorId: 'actor-1',
      }),
    ).rejects.toMatchObject({ code: 'ROOM_UNHEALTHY' });

    expect(room.getStateSnapshot().documentClock).toBe(7);
    expect(room.getStateSnapshot().elements.get('persisted')).toEqual(persisted);

    delete (room as unknown as { applyCommitted?: () => void }).applyCommitted;
    await expect(
      room.execute(createCommand('request-2', makeElement({ id: 'shape-2' })), {
        actorId: 'actor-1',
      }),
    ).resolves.toMatchObject({ replayed: false });
  });

  it('reloads on conditional clock update failure without acknowledging the command', async () => {
    // @covers AC-8
    const persistence = new FakePersistence({
      reloadState: { elements: [], documentClock: 10, roomEpoch: 0, slotClocks: [] },
    });
    persistence.failCommit = new SyncRoomPersistenceError('CONDITIONAL_CLOCK_CONFLICT');
    const room = new SyncRoom({ roomId: 'room-1', persistence });

    await expect(
      room.execute(createCommand('request-1', makeElement({ id: 'shape' })), {
        actorId: 'actor-1',
      }),
    ).rejects.toMatchObject({ code: 'ROOM_UNHEALTHY' });

    expect(room.getStateSnapshot().documentClock).toBe(10);
    expect(room.getStateSnapshot().elements.size).toBe(0);
  });

  it('classifies transient patch durability as relaxed and final/discrete commands as durable', () => {
    // @covers AC-9
    const transientPatch: PatchSlotsCommand = {
      ...patchCommand('drag-1'),
      persistence: {
        transient: true,
        resendable: false,
        storeProcessedRequest: false,
        durability: 'relaxed',
      },
    };

    expect(resolveSyncCommandPersistencePolicy(transientPatch)).toEqual({
      durability: 'relaxed',
      resendable: false,
      storeProcessedRequest: false,
    });
    expect(resolveSyncCommandPersistencePolicy(patchCommand('final-1'))).toEqual({
      durability: 'durable',
      resendable: true,
      storeProcessedRequest: true,
    });
    expect(resolveSyncCommandPersistencePolicy(deleteCommand('delete-1'))).toEqual({
      durability: 'durable',
      resendable: true,
      storeProcessedRequest: true,
    });
  });

  it('sets relaxed PostgreSQL commit mode only for transient patch commits', async () => {
    // @covers AC-9
    const tx = createFakePrismaTx();
    const persistence = createPrismaSyncRoomPersistence({
      processedRequest: tx.processedRequest,
      $transaction: async (task) => task(tx),
    });
    const command = patchCommand('drag-1');
    const result = minimalResult(command);

    await persistence.commitChangeSet({
      command,
      actorId: 'actor-1',
      payloadHash: 'hash',
      expectedDocumentClock: 0,
      result,
      policy: { durability: 'relaxed', resendable: false, storeProcessedRequest: false },
      slotClocks: new Map(),
    });

    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith('SET LOCAL synchronous_commit = off');
    expect(tx.processedRequest.create).not.toHaveBeenCalled();
  });

  it('forbids resendable commands that skip ProcessedRequest while allowing transient patches', () => {
    // @covers AC-10
    expect(() =>
      resolveSyncCommandPersistencePolicy({
        ...patchCommand('bad-1'),
        persistence: { resendable: true, storeProcessedRequest: false },
      }),
    ).toThrow('Resendable commands must persist ProcessedRequest.');

    expect(
      resolveSyncCommandPersistencePolicy({
        ...patchCommand('drag-1'),
        persistence: {
          transient: true,
          resendable: false,
          storeProcessedRequest: false,
          durability: 'relaxed',
        },
      }),
    ).toMatchObject({ storeProcessedRequest: false });
  });
});

class FakePersistence implements SyncRoomPersistence {
  readonly commits: SyncRoomPersistenceCommit[] = [];
  failCommit: Error | null = null;
  private readonly processedRequests = new Map<string, SyncRoomProcessedRequest>();

  constructor(private readonly options: { reloadState?: SyncRoomReloadState } = {}) {}

  findProcessedRequest({
    actorId,
    requestId,
  }: {
    roomId: string;
    actorId: string | null;
    requestId: string;
  }): SyncRoomProcessedRequest | null {
    return this.processedRequests.get(toKey(actorId, requestId)) ?? null;
  }

  commitChangeSet(commit: SyncRoomPersistenceCommit): void {
    if (this.failCommit) throw this.failCommit;
    this.commits.push(commit);
    if (commit.policy.storeProcessedRequest) {
      this.processedRequests.set(toKey(commit.actorId, commit.command.requestId), {
        payloadHash: commit.payloadHash,
        result: commit.result,
      });
    }
  }

  reloadState(): SyncRoomReloadState {
    return this.options.reloadState ?? { elements: [], documentClock: 0, roomEpoch: 0, slotClocks: [] };
  }
}

function createCommand(requestId: string, element: Element): CreateElementCommand {
  return {
    kind: 'create-element',
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId: 'room-1',
    requestId,
    clientClock: 1,
    baseRoomEpoch: 0,
    element,
  };
}

function patchCommand(requestId: string): PatchSlotsCommand {
  return {
    kind: 'patch-slots',
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId: 'room-1',
    requestId,
    clientClock: 1,
    baseRoomEpoch: 0,
    patches: [
      {
        elementId: 'shape',
        slot: 'transform.position',
        baseClock: 0,
        changes: { x: 10, y: 20 },
      },
    ],
  };
}

function deleteCommand(requestId: string): DeleteElementsCommand {
  return {
    kind: 'delete-elements',
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId: 'room-1',
    requestId,
    clientClock: 1,
    baseRoomEpoch: 0,
    elementIds: ['shape-1', 'shape-2', 'shape-3'],
  };
}

function createPlan(command: CreateElementCommand): SyncRoomPlan {
  return {
    created: [command.element],
    normalizedOrder: [{ elementId: command.element.id, zIndex: command.element.zIndex }],
  };
}

function minimalResult(command: SyncCommand): SyncRoomExecutionResult {
  return {
    command,
    actorId: 'actor-1',
    changeSet: {
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId: command.roomId,
      requestId: command.requestId,
      serverClock: 1,
      roomEpoch: 0,
      originActorId: 'actor-1',
      originRequestIds: [command.requestId],
      reason: 'patch_clean' as const,
      slotPatches: [],
      puts: [],
      deletes: [],
      created: [],
      patched: [],
      deleted: [],
      slotClocks: [],
      normalizedOrder: [],
    },
  };
}

function createFakePrismaTx() {
  return {
    $executeRawUnsafe: vi.fn().mockResolvedValue({}),
    room: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    record: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    tombstone: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    processedRequest: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

function toKey(actorId: string | null, requestId: string): string {
  return `${actorId ?? 'anonymous'}:${requestId}`;
}
