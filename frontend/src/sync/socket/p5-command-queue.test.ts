import type {
  CommittedChangeSet,
  Element,
  PatchSlotsCommand,
  ReorderElementsCommand,
  SyncAck,
  SyncBroadcast,
  SyncCommand,
} from '../../types/shared';
import { SYNC_PROTOCOL_VERSION, SYNC_SCHEMA_VERSION, WS_EVENTS } from '../../types/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MutationEvent } from '../../store/mutation-pipeline';
import { patchElement } from '../../store/mutation-pipeline';
import { useElementsStore } from '../../store/elements.store';
import { useCameraStore } from '../../store/camera.store';
import { useInteractionStore } from '../../store/interaction.store';
import {
  clearPendingSyncCommands,
  createUndoPatchCommand,
  DURABLE_DRAG_FLUSH_MS,
  enqueueMutationSyncCommands,
  flushPendingSyncCommands,
  MAX_QUEUED_COMMANDS_PER_CLIENT_ROOM,
  PRESENCE_PREVIEW_THROTTLE_MS,
  settleSyncCommandRequest,
} from './p5-command-queue';
import { clearMemoryDurableOutboxForTests } from './durable-outbox';
import { hydratePendingSyncCommandsFromOutbox } from './p5-durable-outbox';
import {
  applyRoomDiff,
  applyRoomReplaced,
  applyRoomSnapshot,
  processSyncAck,
  processSyncBroadcast,
  queuePendingSyncRequest,
} from './p5-reconciliation';
import { clearSocketSubscriptions, registerSocketSubscriptions } from './subscriptions';
import {
  applyKnownSlotClocks,
  getSocketState,
  resetReconnectState,
  setLastServerClock,
} from './state';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  clearMemoryDurableOutboxForTests();
  resetReconnectState();
  useElementsStore.setState({ elements: [] });
  useInteractionStore.getState().reset();
  useCameraStore.setState({ camera: { x: 0, y: 0, zoom: 1 } });
});

afterEach(() => {
  clearSocketSubscriptions();
  clearPendingSyncCommands();
  clearMemoryDurableOutboxForTests();
  vi.useRealTimers();
});

describe('P5 command queue drag flushing and backpressure', () => {
  it('coalesces continuous drag into a 100ms durable patch window and sends final patch', () => {
    // @covers AC-1
    const emit = vi.fn();
    getSocketState().socket = { emit, connected: true } as never;
    getSocketState().roomId = 'room-1';

    enqueueMutationSyncCommands(patchEvent(0, 10), 'room-1', { now: 0 });
    vi.advanceTimersByTime(33);
    enqueueMutationSyncCommands(patchEvent(10, 20), 'room-1', { now: 33 });
    vi.advanceTimersByTime(33);
    enqueueMutationSyncCommands(patchEvent(20, 30), 'room-1', { now: 66 });

    expect(emit).not.toHaveBeenCalled();
    expect(getSocketState().queuedSyncCommands).toHaveLength(1);

    vi.advanceTimersByTime(DURABLE_DRAG_FLUSH_MS);

    expect(emit).toHaveBeenCalledTimes(1);
    const command = emittedCommand(emit, 0) as PatchSlotsCommand;
    expect(command.kind).toBe('patch-slots');
    expect(command.persistence).toMatchObject({
      durability: 'relaxed',
      transient: true,
      resendable: false,
      storeProcessedRequest: false,
    });
    expect(command.patches[0]).toMatchObject({
      slot: 'transform.position',
      changes: { x: 30, y: 0 },
      inverseChanges: { x: 0, y: 0 },
    });

    enqueueMutationSyncCommands(patchEvent(30, 40), 'room-1', { final: true, now: 200 });

    expect(emit).toHaveBeenCalledTimes(2);
    const finalCommand = emittedCommand(emit, 1) as PatchSlotsCommand;
    expect(finalCommand.persistence).toMatchObject({
      durability: 'durable',
      resendable: true,
      storeProcessedRequest: true,
    });
    expect(finalCommand.patches[0]?.changes).toEqual({ x: 40, y: 0 });
  });

  it('preserves first inverse while squashing and pauses instead of dropping discrete overload', () => {
    // @covers AC-2
    getSocketState().socket = { emit: vi.fn(), connected: false } as never;
    getSocketState().roomId = 'room-1';

    enqueueMutationSyncCommands(patchEvent(0, 10), 'room-1', { now: 0 });
    enqueueMutationSyncCommands(patchEvent(10, 20), 'room-1', { now: 1 });

    const patchCommand = getSocketState().queuedSyncCommands[0]?.command as PatchSlotsCommand;
    expect(patchCommand.patches).toHaveLength(1);
    expect(patchCommand.patches[0]?.changes).toEqual({ x: 20, y: 0 });
    expect(patchCommand.patches[0]?.inverseChanges).toEqual({ x: 0, y: 0 });

    clearPendingSyncCommands();
    for (let index = 0; index < MAX_QUEUED_COMMANDS_PER_CLIENT_ROOM + 1; index += 1) {
      enqueueMutationSyncCommands(createEvent(`shape-${index}`), 'room-1', { now: index });
    }

    expect(getSocketState().queuedSyncCommands).toHaveLength(
      MAX_QUEUED_COMMANDS_PER_CLIENT_ROOM + 1,
    );
    expect(
      getSocketState().queuedSyncCommands.every(
        (queued) => queued.command.kind === 'create-element',
      ),
    ).toBe(true);
    expect(getSocketState().pausedForResync).toBe(true);
  });

  it('keeps multi-slot patches in one command with one request id', () => {
    // @covers C1
    const emit = vi.fn();
    getSocketState().socket = { emit, connected: true } as never;
    getSocketState().roomId = 'room-1';

    enqueueMutationSyncCommands(
      {
        type: 'patch',
        before: [makeElement({ id: 'shape-1', x: 0, width: 100 })],
        elements: [makeElement({ id: 'shape-1', x: 10, width: 120 })],
      },
      'room-1',
      { final: true, now: 0 },
    );

    const command = emittedCommand(emit, 0) as PatchSlotsCommand;
    expect(command.kind).toBe('patch-slots');
    expect(command.patches.map((patch) => patch.slot)).toEqual([
      'transform.position',
      'transform.size',
    ]);
    expect(new Set(command.patches.map(() => command.requestId)).size).toBe(1);
  });

  it('coalesces overlapping patch commands without splitting new slots into sibling requests', () => {
    // @covers C1
    getSocketState().socket = { emit: vi.fn(), connected: false } as never;
    getSocketState().roomId = 'room-1';

    enqueueMutationSyncCommands(
      {
        type: 'patch',
        before: [makeElement({ id: 'shape-1', x: 0, width: 100 })],
        elements: [makeElement({ id: 'shape-1', x: 10, width: 100 })],
      },
      'room-1',
      { now: 0 },
    );
    enqueueMutationSyncCommands(
      {
        type: 'patch',
        before: [makeElement({ id: 'shape-1', x: 10, width: 100 })],
        elements: [makeElement({ id: 'shape-1', x: 20, width: 140 })],
      },
      'room-1',
      { final: true, now: 50 },
    );

    expect(getSocketState().queuedSyncCommands).toHaveLength(1);
    const command = getSocketState().queuedSyncCommands[0]!.command as PatchSlotsCommand;
    expect(command.patches.map((patch) => patch.slot)).toEqual([
      'transform.position',
      'transform.size',
    ]);
  });

  it('does not emit transform patches for linear elements', () => {
    // @covers H4
    const emit = vi.fn();
    getSocketState().socket = { emit, connected: true } as never;
    getSocketState().roomId = 'room-1';
    const before = makeElement({
      id: 'line-1',
      type: 'line',
      x: 0,
      width: 10,
      props: {
        ...makeElement().props,
        points: [
          [0, 0],
          [10, 0],
        ],
      },
    });
    const after = makeElement({
      id: 'line-1',
      type: 'line',
      x: 5,
      width: 10,
      props: {
        ...makeElement().props,
        points: [
          [5, 0],
          [15, 0],
        ],
      },
    });

    enqueueMutationSyncCommands({ type: 'patch', before: [before], elements: [after] }, 'room-1', {
      final: true,
      now: 0,
    });

    const command = emittedCommand(emit, 0) as PatchSlotsCommand;
    expect(command.patches.some((patch) => patch.slot.startsWith('transform.'))).toBe(false);
    expect(command.patches.map((patch) => patch.slot)).toContain('geometry.points');
  });

  it('syncs highlighter movement through geometry points, not transform patches', () => {
    const emit = vi.fn();
    getSocketState().socket = { emit, connected: true } as never;
    getSocketState().roomId = 'room-1';
    const before = makeElement({
      id: 'highlighter-1',
      type: 'highlighter',
      x: 0,
      y: 0,
      width: 20,
      height: 20,
      props: {
        ...makeElement().props,
        opacity: 0.35,
        strokeWidth: 14,
        points: [
          [0, 0],
          [10, 20],
          [20, 0],
        ],
      },
    });
    const after = makeElement({
      id: 'highlighter-1',
      type: 'highlighter',
      x: 5,
      y: 5,
      width: 20,
      height: 20,
      props: {
        ...before.props,
        points: [
          [5, 5],
          [15, 25],
          [25, 5],
        ],
      },
    });

    enqueueMutationSyncCommands({ type: 'patch', before: [before], elements: [after] }, 'room-1', {
      final: true,
      now: 0,
    });

    const command = emittedCommand(emit, 0) as PatchSlotsCommand;
    expect(command.patches.some((patch) => patch.slot.startsWith('transform.'))).toBe(false);
    expect(command.patches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slot: 'geometry.points',
          changes: { points: after.props.points },
        }),
      ]),
    );
  });

  it('creates safe single-slot undo only when the slot clock still matches', () => {
    // @covers AC-6
    applyKnownSlotClocks([{ elementId: 'shape-1', slot: 'transform.position', clock: 4 }]);

    const ready = createUndoPatchCommand(
      'room-1',
      'shape-1',
      'transform.position',
      { x: 0, y: 0 },
      4,
    );
    const conflict = createUndoPatchCommand(
      'room-1',
      'shape-1',
      'transform.position',
      { x: 0, y: 0 },
      3,
    );

    expect(ready.status).toBe('ready');
    expect(ready.status === 'ready' ? ready.command.patches[0]?.changes : null).toEqual({
      x: 0,
      y: 0,
    });
    expect(conflict).toEqual({ status: 'conflict', reason: 'slot-clock-changed' });
  });

  it('keeps create dependency order and never sends patch/delete before create', () => {
    // @covers AC-7
    const emit = vi.fn();
    getSocketState().socket = { emit, connected: true } as never;
    getSocketState().roomId = 'room-1';

    enqueueMutationSyncCommands(createEvent('created-1'), 'room-1', { now: 0 });
    const createCommand = emittedCommand(emit, 0);
    enqueueMutationSyncCommands(patchEvent(0, 50, 'created-1'), 'room-1', {
      final: true,
      now: 1,
    });

    expect(emit).toHaveBeenCalledTimes(1);
    expect(getSocketState().queuedSyncCommands[0]?.dependsOnRequestId).toBe(
      createCommand.requestId,
    );

    settleSyncCommandRequest(createCommand.requestId);
    flushPendingSyncCommands(true);

    expect(emit).toHaveBeenCalledTimes(2);
    expect(emittedCommand(emit, 1).kind).toBe('patch-slots');
  });

  it('promotes queued create dependencies before dependent patches', () => {
    // @covers H5
    const emit = vi.fn();
    getSocketState().socket = { emit, connected: false } as never;
    getSocketState().roomId = 'room-1';

    enqueueMutationSyncCommands(createEvent('created-1'), 'room-1', { now: 0 });
    const create = getSocketState().queuedSyncCommands[0]!;
    clearPendingSyncCommands();
    getSocketState().socket = { emit, connected: true } as never;
    getSocketState().queuedSyncCommands = [
      {
        command: {
          protocolVersion: SYNC_PROTOCOL_VERSION,
          schemaVersion: SYNC_SCHEMA_VERSION,
          roomId: 'room-1',
          requestId: 'patch-request',
          clientClock: 1,
          baseRoomEpoch: 0,
          persistence: { durability: 'durable', resendable: true, storeProcessedRequest: true },
          kind: 'patch-slots',
          patches: [
            {
              elementId: 'created-1',
              slot: 'transform.position',
              baseClock: 0,
              changes: { x: 50, y: 0 },
            },
          ],
        },
        dependsOnRequestId: create.command.requestId,
        sendAfter: 0,
        createdAt: 1,
      },
      create,
    ];

    flushPendingSyncCommands(true);

    expect(emittedCommand(emit, 0).kind).toBe('create-element');
    expect(getSocketState().queuedSyncCommands[0]?.command.kind).toBe('patch-slots');
  });

  it('sends draft/selection preview as ephemeral events, not SyncCommand persistence', () => {
    // @covers AC-8
    const emit = vi.fn();
    getSocketState().socket = { emit, connected: true } as never;
    getSocketState().roomId = 'room-1';
    registerSocketSubscriptions('room-1');

    useInteractionStore.getState().setSelectedIds(['shape-1']);
    useInteractionStore.getState().setDraftElement(makeElement({ id: 'draft-1', x: 5 }));
    useCameraStore.getState().setCamera({ x: 10, y: 20, zoom: 2 });
    vi.advanceTimersByTime(PRESENCE_PREVIEW_THROTTLE_MS);

    expect(emit).toHaveBeenCalledWith(
      WS_EVENTS.CURSOR_MOVE,
      expect.objectContaining({ selectedIds: ['shape-1'] }),
    );
    expect(emit).toHaveBeenCalledWith(
      WS_EVENTS.ELEMENT_DRAFT,
      expect.objectContaining({ elements: [expect.objectContaining({ id: 'draft-1' })] }),
    );
    expect(emit.mock.calls.some((call) => call[0] === WS_EVENTS.SYNC_COMMAND)).toBe(false);
  });

  it('sends committed patch mutations from subscriptions as durable commands', () => {
    const emit = vi.fn();
    const element = makeElement({ id: 'shape-1', x: 0 });
    useElementsStore.setState({ elements: [element] });
    getSocketState().socket = { emit, connected: true } as never;
    getSocketState().roomId = 'room-1';
    registerSocketSubscriptions('room-1');

    patchElement('shape-1', { x: 25 });

    const command = emittedCommand(emit, 0) as PatchSlotsCommand;
    expect(command.kind).toBe('patch-slots');
    expect(command.persistence).toMatchObject({
      durability: 'durable',
      resendable: true,
      storeProcessedRequest: true,
    });
  });

  it('materializes z-order updates as reorder commands', () => {
    const emit = vi.fn();
    const bottom = makeElement({ id: 'bottom', zIndex: 1 });
    const top = makeElement({ id: 'top', zIndex: 2 });
    useElementsStore.setState({ elements: [{ ...bottom, zIndex: 3 }, top] });
    getSocketState().socket = { emit, connected: true } as never;
    getSocketState().roomId = 'room-1';

    enqueueMutationSyncCommands(
      {
        type: 'update',
        before: [bottom],
        elements: [{ ...bottom, zIndex: 3 }],
      },
      'room-1',
      { now: 0 },
    );

    const command = emittedCommand(emit, 0) as ReorderElementsCommand;
    expect(command.kind).toBe('reorder-elements');
    expect(command.moves).toEqual([
      { elementId: 'bottom', afterElementId: 'top', baseOrderClock: 0 },
    ]);
  });

  it('requests a room diff when backpressure pauses the queue', () => {
    const emit = vi.fn();
    getSocketState().socket = { emit, connected: false } as never;
    getSocketState().roomId = 'room-1';

    for (let index = 0; index < MAX_QUEUED_COMMANDS_PER_CLIENT_ROOM + 1; index += 1) {
      enqueueMutationSyncCommands(createEvent(`shape-${index}`), 'room-1', { now: index });
    }

    expect(getSocketState().pausedForResync).toBe(true);
    expect(emit).toHaveBeenCalledWith(WS_EVENTS.ROOM_DIFF_REQUEST, {
      roomId: 'room-1',
      lastServerClock: 0,
      roomEpoch: 0,
      pendingRequests: [],
      fromClock: 0,
    });
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

    enqueueMutationSyncCommands(patchEvent(0, 30), 'room-1', { now: 0 });
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
    queuePendingSyncRequest({ requestId: 'late-ack', actorId: 'actor-1', clientClock: 0 });

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

  it('uses restore-elements for redo of a tombstoned freehand create', () => {
    // @covers undo/redo restore protocol
    const emit = vi.fn();
    const freehand = makeElement({
      id: 'ink-1',
      type: 'freehand',
      props: {
        ...makeElement().props,
        fillColor: 'transparent',
        points: [
          [0, 0],
          [10, 10],
        ],
      },
    });
    getSocketState().socket = { emit, connected: true } as never;
    getSocketState().roomId = 'room-1';
    getSocketState().tombstoneElementIds.add('ink-1');

    enqueueMutationSyncCommands(restoreEvent(freehand), 'room-1', { now: 0 });

    const command = emittedCommand(emit, 0);
    expect(command.kind).toBe('restore-elements');
    if (command.kind !== 'restore-elements') return;
    expect(command.elements[0]).toMatchObject({ id: 'ink-1', type: 'freehand' });
  });

  it('undo of an unsent create cancels the queued create without sending a delete', () => {
    // @covers undo/redo queued create cancellation
    getSocketState().socket = { emit: vi.fn(), connected: false } as never;
    getSocketState().roomId = 'room-1';
    const created = makeElement({ id: 'offline-create' });

    enqueueMutationSyncCommands({ type: 'create', elements: [created], before: [] }, 'room-1', {
      now: 0,
    });
    enqueueMutationSyncCommands({ type: 'delete', elements: [], before: [created] }, 'room-1', {
      now: 1,
    });

    expect(getSocketState().queuedSyncCommands).toEqual([]);
  });

  it('rematerializes server state after a reject without serverChangeSet', () => {
    // @covers M1
    const emit = vi.fn();
    const optimistic = makeElement({ id: 'created-1' });
    useElementsStore.setState({ elements: [optimistic] });
    getSocketState().serverElements = [];
    getSocketState().hasServerState = true;
    getSocketState().socket = { emit, connected: true } as never;
    getSocketState().roomId = 'room-1';

    enqueueMutationSyncCommands(createEvent('created-1'), 'room-1', { now: 0 });
    const requestId = getSocketState().inFlightSyncCommands[0]!.command.requestId;
    queuePendingSyncRequest({ requestId, actorId: null, clientClock: 0 });

    processSyncAck({
      status: 'reject',
      ...ackBase(requestId, 0),
      reason: 'FORBIDDEN',
    });

    expect(useElementsStore.getState().elements).toEqual([]);
  });

  it('drops processed reconnect requests without double-applying them', () => {
    // @covers AC-5
    const emit = vi.fn();
    getSocketState().socket = { emit, connected: true } as never;
    getSocketState().roomId = 'room-1';
    enqueueMutationSyncCommands(createEvent('created-1'), 'room-1', { now: 0 });
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
});

describe('P5 durable sync outbox', () => {
  it('hydrates a durable offline command after reload and resends it when still relevant', async () => {
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
    getSocketState().socket = { emit, connected: false } as never;
    getSocketState().roomId = 'room-1';

    enqueueMutationSyncCommands(
      {
        type: 'patch',
        before: [initial],
        elements: [makeElement({ id: 'shape-1', x: 40 })],
      },
      'room-1',
      { final: true, now: 0 },
    );
    await flushAsyncWork();
    const requestId = getSocketState().queuedSyncCommands[0]?.command.requestId;
    expect(requestId).toBeDefined();

    resetReconnectState();
    useElementsStore.setState({ elements: [] });
    getSocketState().roomId = 'room-1';
    getSocketState().socket = { emit, connected: true } as never;

    await hydratePendingSyncCommandsFromOutbox('room-1');

    expect(getSocketState().inFlightSyncCommands.map((queued) => queued.command.requestId)).toEqual(
      [requestId],
    );
    expect(getSocketState().pendingSyncRequests).toEqual([
      { requestId, actorId: null, clientClock: 0 },
    ]);

    applyRoomSnapshot({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId: 'room-1',
      serverClock: 0,
      roomEpoch: 0,
      elements: [initial],
      slotClocks: [{ elementId: 'shape-1', slot: 'transform.position', clock: 0 }],
      pendingRequests: [{ requestId: requestId!, status: 'unknown' }],
    });
    flushPendingSyncCommands(true);

    expect(emit).toHaveBeenCalledWith(
      WS_EVENTS.SYNC_COMMAND,
      expect.objectContaining({ requestId }),
    );
  });

  it('resends a hydrated durable command after a first-join snapshot without pending statuses', async () => {
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
    getSocketState().socket = { emit, connected: false } as never;
    getSocketState().roomId = 'room-1';

    enqueueMutationSyncCommands(
      {
        type: 'patch',
        before: [initial],
        elements: [makeElement({ id: 'shape-1', x: 40 })],
      },
      'room-1',
      { final: true, now: 0 },
    );
    await flushAsyncWork();
    const requestId = getSocketState().queuedSyncCommands[0]?.command.requestId;
    expect(requestId).toBeDefined();

    resetReconnectState();
    getSocketState().roomId = 'room-1';
    getSocketState().socket = { emit, connected: true } as never;
    await hydratePendingSyncCommandsFromOutbox('room-1');

    applyRoomSnapshot({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId: 'room-1',
      serverClock: 0,
      roomEpoch: 0,
      elements: [initial],
      slotClocks: [{ elementId: 'shape-1', slot: 'transform.position', clock: 0 }],
    });
    flushPendingSyncCommands(true);

    expect(emit).toHaveBeenCalledWith(
      WS_EVENTS.SYNC_COMMAND,
      expect.objectContaining({ requestId }),
    );
  });

  it('resends a hydrated durable move after another tab changed a different slot', async () => {
    const emit = vi.fn();
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
    getSocketState().socket = { emit, connected: false } as never;
    getSocketState().roomId = 'room-1';

    enqueueMutationSyncCommands(
      {
        type: 'patch',
        before: [initial],
        elements: [makeElement({ id: 'shape-1', x: 40 })],
      },
      'room-1',
      { final: true, now: 0 },
    );
    await flushAsyncWork();
    const requestId = getSocketState().queuedSyncCommands[0]?.command.requestId;
    expect(requestId).toBeDefined();

    resetReconnectState();
    getSocketState().roomId = 'room-1';
    getSocketState().socket = { emit, connected: true } as never;
    await hydratePendingSyncCommandsFromOutbox('room-1');

    applyRoomSnapshot({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId: 'room-1',
      serverClock: 1,
      roomEpoch: 0,
      elements: [
        makeElement({
          id: 'shape-1',
          x: 0,
          props: { ...makeElement().props, fillColor: '#ff0000' },
        }),
      ],
      slotClocks: [
        { elementId: 'shape-1', slot: 'transform.position', clock: 0 },
        { elementId: 'shape-1', slot: 'style.fillColor', clock: 1 },
      ],
    });
    flushPendingSyncCommands(true);

    expect(emit).toHaveBeenCalledWith(
      WS_EVENTS.SYNC_COMMAND,
      expect.objectContaining({ requestId }),
    );
    expect(useElementsStore.getState().elements[0]).toMatchObject({
      x: 40,
      props: expect.objectContaining({ fillColor: '#ff0000' }),
    });
  });

  it('drops a hydrated durable command when server truth changed its slot clock', async () => {
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
    getSocketState().socket = { emit, connected: false } as never;
    getSocketState().roomId = 'room-1';

    enqueueMutationSyncCommands(
      {
        type: 'patch',
        before: [initial],
        elements: [makeElement({ id: 'shape-1', x: 40 })],
      },
      'room-1',
      { final: true, now: 0 },
    );
    await flushAsyncWork();
    const requestId = getSocketState().queuedSyncCommands[0]?.command.requestId;
    expect(requestId).toBeDefined();

    resetReconnectState();
    getSocketState().roomId = 'room-1';
    getSocketState().socket = { emit, connected: true } as never;
    await hydratePendingSyncCommandsFromOutbox('room-1');

    applyRoomSnapshot({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId: 'room-1',
      serverClock: 1,
      roomEpoch: 0,
      elements: [makeElement({ id: 'shape-1', x: 10 })],
      slotClocks: [{ elementId: 'shape-1', slot: 'transform.position', clock: 1 }],
      pendingRequests: [{ requestId: requestId!, status: 'unknown' }],
    });
    flushPendingSyncCommands(true);
    await flushAsyncWork();

    expect(getSocketState().inFlightSyncCommands).toEqual([]);
    expect(getSocketState().queuedSyncCommands).toEqual([]);
    expect(getSocketState().pendingSyncRequests).toEqual([]);
    expect(emit).not.toHaveBeenCalledWith(
      WS_EVENTS.SYNC_COMMAND,
      expect.objectContaining({ requestId }),
    );

    resetReconnectState();
    getSocketState().roomId = 'room-1';
    await hydratePendingSyncCommandsFromOutbox('room-1');
    expect(getSocketState().inFlightSyncCommands).toEqual([]);
  });

  it('does not requeue live in-flight commands when an unrelated diff omits pending statuses', () => {
    const emit = vi.fn();
    const initial = makeElement({ id: 'shape-1', x: 0, props: { ...makeElement().props } });
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
    getSocketState().socket = { emit, connected: true } as never;
    getSocketState().roomId = 'room-1';

    enqueueMutationSyncCommands(
      {
        type: 'patch',
        before: [initial],
        elements: [makeElement({ id: 'shape-1', x: 40 })],
      },
      'room-1',
      { final: true, now: 0 },
    );
    const requestId = getSocketState().inFlightSyncCommands[0]?.command.requestId;
    expect(requestId).toBeDefined();
    emit.mockClear();

    applyRoomDiff({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId: 'room-1',
      fromClock: 0,
      toClock: 1,
      serverClock: 1,
      roomEpoch: 0,
      changed: [
        makeElement({
          id: 'shape-1',
          x: 0,
          props: { ...makeElement().props, fillColor: '#ff0000' },
        }),
      ],
      deleted: [],
      slotClocks: [{ elementId: 'shape-1', slot: 'style.fillColor', clock: 1 }],
      hasMore: false,
    });
    flushPendingSyncCommands(true);

    expect(getSocketState().inFlightSyncCommands.map((queued) => queued.command.requestId)).toEqual(
      [requestId],
    );
    expect(getSocketState().queuedSyncCommands).toEqual([]);
    expect(emit).not.toHaveBeenCalledWith(
      WS_EVENTS.SYNC_COMMAND,
      expect.objectContaining({ requestId }),
    );
    expect(useElementsStore.getState().elements[0]).toMatchObject({
      x: 40,
      props: expect.objectContaining({ fillColor: '#ff0000' }),
    });
  });

  it('clears durable commands when the room is replaced by server truth', async () => {
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
    getSocketState().socket = { emit: vi.fn(), connected: false } as never;
    getSocketState().roomId = 'room-1';

    enqueueMutationSyncCommands(
      {
        type: 'patch',
        before: [initial],
        elements: [makeElement({ id: 'shape-1', x: 40 })],
      },
      'room-1',
      { final: true, now: 0 },
    );
    await flushAsyncWork();
    expect(getSocketState().queuedSyncCommands).toHaveLength(1);

    applyRoomReplaced({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      schemaVersion: SYNC_SCHEMA_VERSION,
      roomId: 'room-1',
      serverClock: 1,
      roomEpoch: 1,
      elements: [makeElement({ id: 'replacement' })],
      slotClocks: [{ elementId: 'replacement', slot: 'transform.position', clock: 1 }],
    });
    await flushAsyncWork();

    resetReconnectState();
    getSocketState().roomId = 'room-1';
    await hydratePendingSyncCommandsFromOutbox('room-1');
    expect(getSocketState().inFlightSyncCommands).toEqual([]);
  });
});

function emittedCommand(emit: ReturnType<typeof vi.fn>, index: number): SyncCommand {
  const command = emit.mock.calls[index]?.[1] as SyncCommand | undefined;
  if (!command) throw new Error(`Missing emitted command at ${index}.`);
  return command;
}

function createEvent(id: string): MutationEvent {
  return { type: 'create', elements: [makeElement({ id })], before: [] };
}

function restoreEvent(element: Element): MutationEvent {
  return { type: 'restore', elements: [element], before: [] };
}

function patchEvent(fromX: number, toX: number, id = 'shape-1'): MutationEvent {
  return {
    type: 'patch',
    before: [makeElement({ id, x: fromX })],
    elements: [makeElement({ id, x: toX })],
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

async function flushAsyncWork(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}

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
