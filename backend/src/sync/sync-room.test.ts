import type { CreateElementCommand, Element } from '@vdt/shared';
import { SYNC_PROTOCOL_VERSION, SYNC_SCHEMA_VERSION } from '@vdt/shared';
import { describe, expect, it } from 'vitest';
import { makeElement } from '../test/element-fixtures.js';
import { SyncRoom, type SyncRoomPlan, type SyncRoomPlanner } from './sync-room.js';

describe('SyncRoom', () => {
  it('serializes same-room commands without interleaving plan and apply', async () => {
    // @covers AC-1
    const events: string[] = [];
    const firstPlanEntered = createDeferred<void>();
    const releaseFirstPlan = createDeferred<void>();
    const planner: SyncRoomPlanner = async ({ command }) => {
      events.push(`plan:${command.requestId}`);
      if (command.requestId === 'request-a') {
        firstPlanEntered.resolve();
        await releaseFirstPlan.promise;
      }

      return planCreatedElement(command as CreateElementCommand, {
        commit: () => {
          events.push(`commit:${command.requestId}`);
        },
        afterApply: () => {
          events.push(`apply:${command.requestId}`);
        },
      });
    };
    const room = new SyncRoom({ roomId: 'room-1', planner });

    const first = room.execute(createCommand('room-1', 'request-a', makeElement({ id: 'a' })), {
      actorId: 'actor-1',
    });
    await firstPlanEntered.promise;
    const second = room.execute(createCommand('room-1', 'request-b', makeElement({ id: 'b' })), {
      actorId: 'actor-2',
    });
    await Promise.resolve();

    expect(events).toEqual(['plan:request-a']);

    releaseFirstPlan.resolve();
    await Promise.all([first, second]);

    expect(events).toEqual([
      'plan:request-a',
      'commit:request-a',
      'apply:request-a',
      'plan:request-b',
      'commit:request-b',
      'apply:request-b',
    ]);
    expect([...room.getStateSnapshot().elements.keys()]).toEqual(['a', 'b']);
    expect(room.getStateSnapshot().documentClock).toBe(2);
  });

  it('does not serialize unrelated rooms through a global queue', async () => {
    // @covers AC-2
    const events: string[] = [];
    const blockedPlanEntered = createDeferred<void>();
    const releaseBlockedRoom = createDeferred<void>();
    const blockedPlanner: SyncRoomPlanner = async ({ command }) => {
      events.push(`plan:${command.roomId}`);
      blockedPlanEntered.resolve();
      await releaseBlockedRoom.promise;
      return planCreatedElement(command as CreateElementCommand, {
        afterApply: () => {
          events.push(`apply:${command.roomId}`);
        },
      });
    };
    const fastPlanner: SyncRoomPlanner = ({ command }) => {
      events.push(`plan:${command.roomId}`);
      return planCreatedElement(command as CreateElementCommand, {
        afterApply: () => {
          events.push(`apply:${command.roomId}`);
        },
      });
    };
    const blockedRoom = new SyncRoom({ roomId: 'room-a', planner: blockedPlanner });
    const fastRoom = new SyncRoom({ roomId: 'room-b', planner: fastPlanner });

    const blocked = blockedRoom.execute(
      createCommand('room-a', 'blocked', makeElement({ id: 'blocked' })),
      { actorId: 'actor-1' },
    );
    await blockedPlanEntered.promise;

    const fast = await fastRoom.execute(
      createCommand('room-b', 'fast', makeElement({ id: 'fast' })),
      {
        actorId: 'actor-2',
      },
    );

    expect(fast.changeSet.serverClock).toBe(1);
    expect(events).toEqual(['plan:room-a', 'plan:room-b', 'apply:room-b']);

    releaseBlockedRoom.resolve();
    await blocked;

    expect(events).toEqual(['plan:room-a', 'plan:room-b', 'apply:room-b', 'apply:room-a']);
  });

  it('returns the original committed result for duplicate actor request retries', async () => {
    // @covers AC-3
    let sideEffects = 0;
    const room = new SyncRoom({
      roomId: 'room-1',
      planner: ({ command }) =>
        planCreatedElement(command as CreateElementCommand, {
          commit: () => {
            sideEffects += 1;
          },
        }),
    });
    const command = createCommand('room-1', 'request-1', makeElement({ id: 'once' }));

    const first = await room.execute(command, { actorId: 'actor-1' });
    const retry = await room.execute(command, { actorId: 'actor-1' });

    expect(retry).toBe(first);
    expect(sideEffects).toBe(1);
    expect(room.getStateSnapshot().documentClock).toBe(1);
    expect(room.getStateSnapshot().processedRequests.size).toBe(1);
  });
});

function createCommand(roomId: string, requestId: string, element: Element): CreateElementCommand {
  return {
    kind: 'create-element',
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId,
    requestId,
    clientClock: 100,
    baseRoomEpoch: 0,
    element,
  };
}

function planCreatedElement(
  command: CreateElementCommand,
  hooks: Pick<SyncRoomPlan, 'commit' | 'afterApply'>,
): SyncRoomPlan {
  return {
    created: [command.element],
    normalizedOrder: [{ elementId: command.element.id, zIndex: command.element.zIndex }],
    ...hooks,
  };
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}
