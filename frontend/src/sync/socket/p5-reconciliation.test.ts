import type { CommittedChangeSet, Element, SyncAck, SyncBroadcast } from '../../types/shared';
import { SYNC_PROTOCOL_VERSION, SYNC_SCHEMA_VERSION, WS_EVENTS } from '../../types/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useElementsStore } from '../../store/elements.store';
import {
  applyRoomDiff,
  applyRoomReplaced,
  applyRoomSnapshot,
  processSyncAck,
  processSyncBroadcast,
  queuePendingSyncRequest,
} from './p5-reconciliation';
import { enqueueMutationSyncCommands } from './p5-command-queue';
import { getKnownSlotClock, getSocketState, setLastServerClock, setRoomEpoch } from './state';

beforeEach(() => {
  useElementsStore.setState({ elements: [] });
  setLastServerClock(0);
  const state = getSocketState();
  state.pendingSyncRequests = [];
  state.queuedSyncCommands = [];
  state.inFlightSyncCommands = [];
  state.serverElements = [];
  state.hasServerState = false;
  state.staleAckRequestIds = new Set();
  state.bufferedSyncEvents = [];
  state.socket = null;
  state.roomId = 'room-1';
  setRoomEpoch(0);
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

    // @covers AC-3
    expect(emit).toHaveBeenCalledWith(WS_EVENTS.ROOM_DIFF_REQUEST, {
      roomId: 'room-1',
      lastServerClock: 3,
      roomEpoch: 0,
      pendingRequestIds: [],
      fromClock: 3,
      toClock: 5,
    });
  });

  it('hydrates snapshot clocks only after replacing the full server state', () => {
    // @covers AC-1, AC-7
    useElementsStore.setState({ elements: [makeElement({ id: 'stale-local' })] });

    applyRoomSnapshot({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId: 'room-1',
      serverClock: 9,
      roomEpoch: 4,
      elements: [makeElement({ id: 'server-shape' })],
      slotClocks: [{ elementId: 'server-shape', slot: 'style.fillColor', clock: 9 }],
    });

    expect(useElementsStore.getState().elements.map((element) => element.id)).toEqual([
      'server-shape',
    ]);
    expect(getSocketState().lastServerClock).toBe(9);
    expect(getSocketState().roomEpoch).toBe(4);
    expect(getKnownSlotClock('server-shape', 'style.fillColor')).toBe(9);
  });

  it('applies ROOM_REPLACED as server truth and ignores old ACKs for cleared pending', () => {
    // @covers AC-6
    const serverElement = makeElement({ id: 'server-shape' });
    queuePendingSyncRequest({ requestId: 'old-pending', actorId: 'actor-1' });
    useElementsStore.setState({ elements: [makeElement({ id: 'local-draft' })] });
    getSocketState().bufferedSyncEvents = [
      broadcast(changeSet({ requestId: 'buffered', serverClock: 12 })),
    ];

    applyRoomReplaced({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId: 'room-1',
      serverClock: 10,
      roomEpoch: 3,
      elements: [serverElement],
      slotClocks: [{ elementId: 'server-shape', slot: 'style.fillColor', clock: 10 }],
    });
    const lateAckResult = processSyncAck({
      status: 'commit',
      ...ackBase('old-pending', 11),
      changeSet: changeSet({
        requestId: 'old-pending',
        serverClock: 11,
        roomEpoch: 2,
        slotPatches: [
          {
            elementId: 'server-shape',
            slot: 'style.fillColor',
            baseClock: 0,
            clock: 11,
            changes: { fillColor: '#badbad' },
          },
        ],
      }),
    });

    expect(lateAckResult.status).toBe('ignored-stale');
    expect(getSocketState().pendingSyncRequests).toEqual([]);
    expect(getSocketState().bufferedSyncEvents).toEqual([]);
    expect(useElementsStore.getState().elements).toEqual([serverElement]);
    expect(getSocketState().lastServerClock).toBe(10);
    expect(getSocketState().roomEpoch).toBe(3);
    expect(getKnownSlotClock('server-shape', 'style.fillColor')).toBe(10);
  });

  it('applies ROOM_DIFF slot-aware without originRequestIds or whole-element replacement', () => {
    // @covers AC-7, AC-8
    const existing = makeElement({
      id: 'shape-1',
      x: 10,
      y: 20,
      props: { ...makeElement().props, fillColor: '#ffffff', strokeColor: '#000000' },
    });
    useElementsStore.setState({ elements: [existing] });
    applyRoomSnapshot({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId: 'room-1',
      serverClock: 3,
      roomEpoch: 0,
      elements: [existing],
      slotClocks: [
        { elementId: 'shape-1', slot: 'transform.position', clock: 3 },
        { elementId: 'shape-1', slot: 'style.fillColor', clock: 3 },
      ],
    });

    applyRoomDiff({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId: 'room-1',
      fromClock: 3,
      toClock: 5,
      serverClock: 5,
      roomEpoch: 0,
      changed: [
        makeElement({
          id: 'shape-1',
          x: 999,
          y: 999,
          props: { ...makeElement().props, fillColor: '#00ff00', strokeColor: '#ff0000' },
        }),
      ],
      deleted: [],
      slotClocks: [{ elementId: 'shape-1', slot: 'style.fillColor', clock: 5 }],
      hasMore: false,
    });

    const updated = useElementsStore.getState().elements[0];
    expect(updated).toMatchObject({ id: 'shape-1', x: 10, y: 20 });
    expect(updated?.props.fillColor).toBe('#00ff00');
    expect(updated?.props.strokeColor).toBe('#000000');
    expect(getSocketState().lastServerClock).toBe(5);
    expect(getKnownSlotClock('shape-1', 'style.fillColor')).toBe(5);
  });

  it('replays local optimistic drag over an independent peer color change', () => {
    // @covers AC-3
    const initial = makeElement({ id: 'shape-1', x: 0 });
    applyRoomSnapshot({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId: 'room-1',
      serverClock: 0,
      roomEpoch: 0,
      elements: [initial],
      slotClocks: [
        { elementId: 'shape-1', slot: 'transform.position', clock: 0 },
        { elementId: 'shape-1', slot: 'style.fillColor', clock: 0 },
      ],
    });
    getSocketState().socket = { emit: vi.fn(), connected: false } as never;

    enqueueMutationSyncCommands(
      {
        type: 'patch',
        before: [initial],
        elements: [makeElement({ id: 'shape-1', x: 30 })],
      },
      'room-1',
      { now: 0 },
    );
    useElementsStore.setState({ elements: [makeElement({ id: 'shape-1', x: 30 })] });

    processSyncBroadcast(
      broadcast(
        changeSet({
          requestId: 'peer-color',
          serverClock: 1,
          slotPatches: [
            {
              elementId: 'shape-1',
              slot: 'style.fillColor',
              baseClock: 0,
              clock: 1,
              changes: { fillColor: '#ff0000' },
            },
          ],
          slotClocks: [{ elementId: 'shape-1', slot: 'style.fillColor', clock: 1 }],
        }),
      ),
    );

    const reconciled = useElementsStore.getState().elements[0];
    expect(reconciled).toMatchObject({ id: 'shape-1', x: 30 });
    expect(reconciled?.props.fillColor).toBe('#ff0000');
  });

  it('clears a matching late ACK without overwriting newer optimistic state', () => {
    // @covers AC-4
    setLastServerClock(4);
    useElementsStore.setState({ elements: [makeElement({ id: 'shape-1', x: 50 })] });
    getSocketState().serverElements = [makeElement({ id: 'shape-1', x: 40 })];
    queuePendingSyncRequest({ requestId: 'late-ack', actorId: 'actor-1' });

    const result = processSyncAck({
      status: 'commit',
      ...ackBase('late-ack', 3),
      changeSet: changeSet({
        requestId: 'late-ack',
        serverClock: 3,
        slotPatches: [
          {
            elementId: 'shape-1',
            slot: 'transform.position',
            baseClock: 0,
            clock: 3,
            changes: { x: 5, y: 0 },
          },
        ],
      }),
    });

    expect(result.status).toBe('ignored-stale');
    expect(getSocketState().pendingSyncRequests).toEqual([]);
    expect(useElementsStore.getState().elements[0]?.x).toBe(50);
  });

  it('drops processed reconnect requests without double-applying them', () => {
    // @covers AC-5
    const emit = vi.fn();
    getSocketState().socket = { emit, connected: true } as never;
    getSocketState().roomId = 'room-1';
    enqueueMutationSyncCommands(
      { type: 'create', before: [], elements: [makeElement({ id: 'created-1' })] },
      'room-1',
      { now: 0 },
    );
    const requestId = getSocketState().inFlightSyncCommands[0]?.command.requestId;
    expect(requestId).toBeDefined();

    applyRoomDiff({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId: 'room-1',
      fromClock: 0,
      toClock: 1,
      serverClock: 1,
      roomEpoch: 0,
      changed: [makeElement({ id: 'created-1' })],
      deleted: [],
      slotClocks: [{ elementId: 'created-1', slot: 'style.fillColor', clock: 1 }],
      hasMore: false,
      pendingRequests: [{ requestId: requestId!, status: 'processed', serverClock: 1 }],
    });

    expect(getSocketState().inFlightSyncCommands).toEqual([]);
    expect(getSocketState().pendingSyncRequests).toEqual([]);
    expect(
      useElementsStore.getState().elements.filter((element) => element.id === 'created-1'),
    ).toHaveLength(1);
  });

  it('does not resurrect stale local elements when server truth is empty', () => {
    useElementsStore.setState({ elements: [makeElement({ id: 'stale-local' })] });
    getSocketState().serverElements = [];
    getSocketState().hasServerState = true;

    applyRoomDiff({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId: 'room-1',
      fromClock: 1,
      toClock: 2,
      serverClock: 2,
      roomEpoch: 0,
      changed: [],
      deleted: [],
      slotClocks: [],
      hasMore: false,
    });

    expect(useElementsStore.getState().elements).toEqual([]);
    expect(getSocketState().serverElements).toEqual([]);
  });

  it('does not resend unknown pending commands after slot clocks changed', () => {
    const emit = vi.fn();
    const initial = makeElement({ id: 'shape-1', x: 0 });
    applyRoomSnapshot({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId: 'room-1',
      serverClock: 0,
      roomEpoch: 0,
      elements: [initial],
      slotClocks: [{ elementId: 'shape-1', slot: 'transform.position', clock: 0 }],
    });
    getSocketState().socket = { emit, connected: true } as never;
    enqueueMutationSyncCommands(
      {
        type: 'patch',
        before: [initial],
        elements: [makeElement({ id: 'shape-1', x: 30 })],
      },
      'room-1',
      { final: true, now: 0 },
    );
    const requestId = getSocketState().inFlightSyncCommands[0]?.command.requestId;
    expect(requestId).toBeDefined();

    applyRoomDiff({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId: 'room-1',
      fromClock: 0,
      toClock: 1,
      serverClock: 1,
      roomEpoch: 0,
      changed: [makeElement({ id: 'shape-1', x: 10 })],
      deleted: [],
      slotClocks: [{ elementId: 'shape-1', slot: 'transform.position', clock: 1 }],
      hasMore: false,
      pendingRequests: [{ requestId: requestId!, status: 'unknown' }],
    });

    expect(getSocketState().inFlightSyncCommands).toEqual([]);
    expect(getSocketState().queuedSyncCommands).toEqual([]);
    expect(getSocketState().pendingSyncRequests).toEqual([]);
    expect(emit).toHaveBeenCalledTimes(1);
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
