import type { CommittedChangeSet, Element, SyncAck, SyncBroadcast } from '../../types/shared';
import { SYNC_PROTOCOL_VERSION, SYNC_SCHEMA_VERSION, WS_EVENTS } from '../../types/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useElementsStore } from '../../store/elements.store';
import { processSyncAck, processSyncBroadcast, queuePendingSyncRequest } from './p5-reconciliation';
import { getSocketState, setLastServerClock } from './state';

beforeEach(() => {
  useElementsStore.setState({ elements: [] });
  setLastServerClock(0);
  const state = getSocketState();
  state.pendingSyncRequests = [];
  state.bufferedSyncEvents = [];
  state.socket = null;
});

describe('P5 reconciliation pending and change-set handling', () => {
  it('clears matching pending requests for commit and rebase ACKs', () => {
    // @covers AC-1
    queuePendingSyncRequest({ requestId: 'commit-1', actorId: 'actor-1' });
    queuePendingSyncRequest({ requestId: 'rebase-1', actorId: 'actor-1' });
    queuePendingSyncRequest({ requestId: 'later-1', actorId: 'actor-1' });

    processSyncAck({
      status: 'commit',
      ...ackBase('commit-1', 1),
      changeSet: changeSet({ requestId: 'commit-1', serverClock: 1, reason: 'patch_clean' }),
    });
    processSyncAck({
      status: 'rebase',
      ...ackBase('rebase-1', 2),
      changeSet: changeSet({ requestId: 'rebase-1', serverClock: 2, reason: 'patch_lww_conflict' }),
    });

    expect(getSocketState().pendingSyncRequests).toEqual([
      { requestId: 'later-1', actorId: 'actor-1' },
    ]);
  });

  it('clears local pending from a same-origin broadcast when ACK is missed', () => {
    // @covers AC-2
    queuePendingSyncRequest({ requestId: 'missed-ack', actorId: 'actor-1' });

    processSyncBroadcast(
      broadcast(
        changeSet({
          requestId: 'missed-ack',
          serverClock: 1,
          originActorId: 'actor-1',
          originRequestIds: ['missed-ack'],
        }),
      ),
      { localActorId: 'actor-1' },
    );

    expect(getSocketState().pendingSyncRequests).toEqual([]);
  });

  it('clears rejected pending without dropping newer pending changes', () => {
    // @covers AC-3
    queuePendingSyncRequest({ requestId: 'rejected', actorId: 'actor-1' });
    queuePendingSyncRequest({ requestId: 'newer-slot-change', actorId: 'actor-1' });
    useElementsStore.setState({ elements: [makeElement({ id: 'shape-1' })] });

    processSyncAck({
      status: 'reject',
      ...ackBase('rejected', 1),
      reason: 'STALE_CLIENT_STATE',
    });

    expect(getSocketState().pendingSyncRequests).toEqual([
      { requestId: 'newer-slot-change', actorId: 'actor-1' },
    ]);
    expect(useElementsStore.getState().elements).toHaveLength(1);
  });

  it('applies rebase change-set without emitting a retry command', () => {
    // @covers AC-4
    const emit = vi.fn();
    const state = getSocketState();
    state.socket = { emit } as never;
    useElementsStore.setState({ elements: [makeElement({ id: 'shape-1' })] });
    queuePendingSyncRequest({ requestId: 'rebase-1', actorId: 'actor-1' });

    processSyncAck({
      status: 'rebase',
      ...ackBase('rebase-1', 1),
      changeSet: changeSet({
        requestId: 'rebase-1',
        serverClock: 1,
        reason: 'patch_lww_conflict',
        slotPatches: [
          {
            elementId: 'shape-1',
            slot: 'style.fillColor',
            baseClock: 0,
            clock: 1,
            changes: { fillColor: '#ff0000' },
          },
        ],
      }),
    });

    expect(useElementsStore.getState().elements[0]?.props.fillColor).toBe('#ff0000');
    expect(emit).not.toHaveBeenCalled();
  });

  it('applies slot-only change-set without replacing the whole element', () => {
    // @covers AC-5
    const original = makeElement({ id: 'shape-1', x: 10, y: 20, width: 100 });
    useElementsStore.setState({ elements: [original] });

    processSyncBroadcast(
      broadcast(
        changeSet({
          requestId: 'peer-1',
          serverClock: 1,
          slotPatches: [
            {
              elementId: 'shape-1',
              slot: 'style.fillColor',
              baseClock: 0,
              clock: 1,
              changes: { fillColor: '#00ff00' },
            },
          ],
        }),
      ),
    );

    const updated = useElementsStore.getState().elements[0];
    expect(updated).toMatchObject({ id: 'shape-1', x: 10, y: 20, width: 100 });
    expect(updated?.props.fillColor).toBe('#00ff00');
  });

  it('ignores stale clocks and requests diff on future clock gaps', () => {
    setLastServerClock(3);
    useElementsStore.setState({ elements: [makeElement({ id: 'shape-1' })] });
    const requestRoomDiff = vi.fn();

    const stale = processSyncBroadcast(
      broadcast(
        changeSet({
          requestId: 'stale-1',
          serverClock: 3,
          slotPatches: [
            {
              elementId: 'shape-1',
              slot: 'style.fillColor',
              baseClock: 2,
              clock: 3,
              changes: { fillColor: '#badbad' },
            },
          ],
        }),
      ),
      { requestRoomDiff },
    );
    const gap = processSyncBroadcast(broadcast(changeSet({ requestId: 'gap-1', serverClock: 5 })), {
      requestRoomDiff,
    });

    expect(stale.status).toBe('ignored-stale');
    expect(gap.status).toBe('gap');
    expect(useElementsStore.getState().elements[0]?.props.fillColor).toBe('#ffffff');
    expect(requestRoomDiff).toHaveBeenCalledWith('room-1', 3, 5);
    expect(getSocketState().bufferedSyncEvents).toHaveLength(1);
  });

  it('requests a room diff over the dedicated request event on future clock gaps', () => {
    setLastServerClock(3);
    const emit = vi.fn();
    getSocketState().socket = { emit } as never;

    processSyncBroadcast(broadcast(changeSet({ requestId: 'gap-1', serverClock: 5 })));

    expect(emit).toHaveBeenCalledWith(WS_EVENTS.ROOM_DIFF_REQUEST, {
      roomId: 'room-1',
      fromClock: 3,
      toClock: 5,
    });
  });
});

function ackBase(requestId: string, serverClock: number): Omit<SyncAck, 'status'> {
  return {
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId: 'room-1',
    requestId,
    serverClock,
  };
}

function broadcast(changeSetValue: CommittedChangeSet): SyncBroadcast {
  return {
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId: changeSetValue.roomId,
    serverClock: changeSetValue.serverClock,
    changeSet: changeSetValue,
  };
}

function changeSet(
  overrides: Partial<CommittedChangeSet> & Pick<CommittedChangeSet, 'requestId' | 'serverClock'>,
): CommittedChangeSet {
  return {
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId: 'room-1',
    roomEpoch: 0,
    originActorId: 'actor-2',
    originRequestIds: [overrides.requestId],
    reason: 'patch_clean',
    slotPatches: [],
    puts: [],
    deletes: [],
    created: [],
    patched: [],
    deleted: [],
    slotClocks: [],
    normalizedOrder: [],
    ...overrides,
  };
}

function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'shape-1',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle: 0,
    zIndex: 1,
    version: 1,
    versionNonce: 1,
    updatedAt: 1,
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
    props: {
      strokeColor: '#000000',
      fillColor: '#ffffff',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
    },
    ...overrides,
  };
}
