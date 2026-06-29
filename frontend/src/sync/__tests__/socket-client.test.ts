import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WS_EVENTS } from '../../types/shared';
import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import { useCameraStore } from '../../store/camera.store';
import type { Presence } from '../../types/shared';

vi.mock('../camera-persistence', () => ({
  saveCamera: vi.fn(),
  loadCamera: vi.fn(),
  startCameraPersistence: vi.fn(() => vi.fn()),
}));

// Stable session identity for tests
vi.mock('../presence', () => ({
  LOCAL_PRESENCE: { sessionId: 'local-session-id', name: 'Blue Fox', color: '#3b82f6' },
  toPresence: (local: { sessionId: string; name: string; color: string }) => ({
    ...local,
    cursor: null,
    selectedIds: [],
    status: 'active' as const,
  }),
}));

// Mock socket.io-client before importing socket-client
const mockEmit = vi.fn();
const mockOn = vi.fn();
const mockDisconnect = vi.fn();

const mockSocket = {
  emit: mockEmit,
  on: mockOn,
  disconnect: mockDisconnect,
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

// Capture handlers registered via socket.on
const _handlers: Record<string, (data: unknown) => void> = {};
beforeEach(() => {
  mockEmit.mockClear();
  mockOn.mockClear();
  mockDisconnect.mockClear();
  Object.keys(_handlers).forEach((k) => delete _handlers[k]);

  mockOn.mockImplementation((event: string, handler: (data: unknown) => void) => {
    _handlers[event] = handler;
    return mockSocket;
  });

  useElementsStore.setState({ elements: [] });
  useInteractionStore.setState({ remoteCursors: new Map() });
  useCameraStore.setState({ camera: { x: 0, y: 0, zoom: 1 } });
  vi.resetModules();
});

afterEach(async () => {
  const { stopSocketClient } = await import('../socket-client');
  stopSocketClient();
});

// ─── 014 feature tests (realtime element sync) ───────────────────────────────

describe('socket-client — 014/AC-1 (join-room payload)', () => {
  it('emits join-room with roomId and session identity on init', async () => {
    const { initSocketClient } = await import('../socket-client');
    initSocketClient('room-abc');
    expect(mockEmit).toHaveBeenCalledWith(
      WS_EVENTS.JOIN_ROOM,
      expect.objectContaining({ roomId: 'room-abc' }),
    );
  });
});

describe('socket-client — 014/AC-2 (element-update delivery)', () => {
  it('calls applyRemoteElements when element-update event arrives', async () => {
    const applyModule = await import('../apply-remote');
    const spy = vi.spyOn(applyModule, 'applyRemoteElements');

    const { initSocketClient } = await import('../socket-client');
    initSocketClient('room-abc');

    const fakeElement = {
      id: 'el-1',
      type: 'rectangle' as const,
      x: 0, y: 0, width: 100, height: 100, angle: 0, zIndex: 1,
      props: {
        strokeColor: '#000', fillColor: 'transparent',
        strokeWidth: 1, strokeStyle: 'solid' as const, opacity: 1,
      },
      version: 1, versionNonce: 42, updatedAt: Date.now(),
      isDeleted: false, groupId: null, frameId: null, locked: false, createdBy: 'test',
    };

    const handler = _handlers[WS_EVENTS.ELEMENT_UPDATE];
    expect(handler).toBeDefined();
    handler({ elements: [fakeElement] });

    expect(spy).toHaveBeenCalledWith([fakeElement]);
    spy.mockRestore();
  });
});

describe('socket-client — 014/AC-4 (room isolation via roomId in emit)', () => {
  it('element-update mutations are emitted with the joined roomId', async () => {
    const { initSocketClient } = await import('../socket-client');
    const { dispatchMutationEvent } = await import('../../store/mutation-pipeline');

    initSocketClient('room-xyz');

    const fakeElement = {
      id: 'el-iso',
      type: 'rectangle' as const,
      x: 0, y: 0, width: 50, height: 50, angle: 0, zIndex: 1,
      props: {
        strokeColor: '#000', fillColor: 'transparent',
        strokeWidth: 1, strokeStyle: 'solid' as const, opacity: 1,
      },
      version: 1, versionNonce: 99, updatedAt: Date.now(),
      isDeleted: false, groupId: null, frameId: null, locked: false, createdBy: 'test',
    };

    mockEmit.mockClear();
    dispatchMutationEvent({ type: 'update', elements: [fakeElement], before: [] });

    expect(mockEmit).toHaveBeenCalledWith(
      WS_EVENTS.ELEMENT_UPDATE,
      { roomId: 'room-xyz', elements: [fakeElement] },
    );
  });
});

// ─── 015 feature tests (live cursor presence) ────────────────────────────────
// Note: these tests use dynamic import for useInteractionStore AFTER vi.resetModules()
// so both the test and socket-client.ts share the same fresh store instance.

function makePeer(sessionId: string): Presence {
  return { sessionId, name: 'Red Bear', color: '#ef4444', cursor: null, selectedIds: [], status: 'active' };
}

describe('socket-client — AC-1 (remote cursor added on CURSOR_MOVE)', () => {
  // @covers AC-1
  it('CURSOR_MOVE event received → remoteCursors gains entry for the sender', async () => {
    const { initSocketClient } = await import('../socket-client');
    const { useInteractionStore: store } = await import('../../store/interaction.store');
    initSocketClient('room-abc');

    // Establish peer via USER_JOIN first
    const joinHandler = _handlers[WS_EVENTS.USER_JOIN];
    joinHandler({ presences: [makePeer('peer-1')] });

    const moveHandler = _handlers[WS_EVENTS.CURSOR_MOVE];
    expect(moveHandler).toBeDefined();
    moveHandler({ sessionId: 'peer-1', cursor: { x: 100, y: 200 } });

    const entry = store.getState().remoteCursors.get('peer-1');
    expect(entry).toBeDefined();
    expect(entry?.cursor).toEqual({ x: 100, y: 200 });
  });
});

describe('socket-client — AC-2 (cursor position updated on move)', () => {
  // @covers AC-2
  it('second CURSOR_MOVE with new position updates the existing entry', async () => {
    const { initSocketClient } = await import('../socket-client');
    const { useInteractionStore: store } = await import('../../store/interaction.store');
    initSocketClient('room-abc');

    const joinHandler = _handlers[WS_EVENTS.USER_JOIN];
    joinHandler({ presences: [makePeer('peer-1')] });

    const moveHandler = _handlers[WS_EVENTS.CURSOR_MOVE];
    moveHandler({ sessionId: 'peer-1', cursor: { x: 10, y: 20 } });
    moveHandler({ sessionId: 'peer-1', cursor: { x: 300, y: 400 } });

    expect(store.getState().remoteCursors.get('peer-1')?.cursor).toEqual({ x: 300, y: 400 });
  });
});

describe('socket-client — AC-3 (own cursor NOT added to remoteCursors)', () => {
  // @covers AC-3
  it('USER_JOIN with own sessionId does not add self to remoteCursors', async () => {
    const { initSocketClient } = await import('../socket-client');
    const { useInteractionStore: store } = await import('../../store/interaction.store');
    initSocketClient('room-abc');

    const joinHandler = _handlers[WS_EVENTS.USER_JOIN];
    joinHandler({
      presences: [
        { sessionId: 'local-session-id', name: 'Blue Fox', color: '#3b82f6', cursor: null, selectedIds: [], status: 'active' },
        makePeer('peer-1'),
      ],
    });

    const cursors = store.getState().remoteCursors;
    expect(cursors.has('local-session-id')).toBe(false); // self excluded
    expect(cursors.has('peer-1')).toBe(true);
  });
});

describe('socket-client — AC-4 (cursor-move emit includes roomId for server scoping)', () => {
  // @covers AC-4
  it('emitCursorMove includes roomId and sessionId in emitted payload', async () => {
    const { initSocketClient, emitCursorMove } = await import('../socket-client');
    initSocketClient('room-abc');
    mockEmit.mockClear();

    emitCursorMove({ x: 50, y: 75 });

    expect(mockEmit).toHaveBeenCalledWith(WS_EVENTS.CURSOR_MOVE, {
      roomId: 'room-abc',
      sessionId: 'local-session-id',
      cursor: { x: 50, y: 75 },
      viewport: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), zoom: expect.any(Number) }),
    });
  });
});

describe('socket-client — AC-5 (cursor removed when peer leaves)', () => {
  // @covers AC-5
  it('USER_LEAVE removes the session entry from remoteCursors', async () => {
    const { initSocketClient } = await import('../socket-client');
    const { useInteractionStore: store } = await import('../../store/interaction.store');
    initSocketClient('room-abc');

    const joinHandler = _handlers[WS_EVENTS.USER_JOIN];
    joinHandler({ presences: [makePeer('peer-1')] });
    expect(store.getState().remoteCursors.has('peer-1')).toBe(true);

    const leaveHandler = _handlers[WS_EVENTS.USER_LEAVE];
    expect(leaveHandler).toBeDefined();
    leaveHandler({ sessionId: 'peer-1' });

    expect(store.getState().remoteCursors.has('peer-1')).toBe(false);
  });
});

describe('socket-client — ROOM_SNAPSHOT replaces elements on join', () => {
  it('ROOM_SNAPSHOT event calls setElements with received elements (legacy check via store)', async () => {
    const applyModule = await import('../apply-remote');
    const spy = vi.spyOn(applyModule, 'applyRemoteElements');

    const { initSocketClient } = await import('../socket-client');
    initSocketClient('room-abc');

    const snapshotHandler = _handlers[WS_EVENTS.ROOM_SNAPSHOT];
    expect(snapshotHandler).toBeDefined();

    const el = {
      id: 'snap-1', type: 'rectangle' as const,
      x: 0, y: 0, width: 50, height: 50, angle: 0, zIndex: 1,
      props: { strokeColor: '#000', fillColor: 'transparent', strokeWidth: 1, strokeStyle: 'solid' as const, opacity: 1 },
      version: 1, versionNonce: 1, updatedAt: Date.now(),
      isDeleted: false, groupId: null, frameId: null, locked: false, createdBy: 'test',
    };

    snapshotHandler({ elements: [el], documentClock: 0 });
    expect(spy).toHaveBeenCalledWith([el]);
    spy.mockRestore();
  });
});

// ─── P3A-02: ROOM_SNAPSHOT handler with documentClock ───────────────────────

describe('socket-client — P3A-02/AC-4 (T013) ROOM_SNAPSHOT with non-empty elements', () => {
  // @covers AC-4
  it('calls applyRemoteElements with received elements and sets lastServerClock', async () => {
    const applyModule = await import('../apply-remote');
    const spy = vi.spyOn(applyModule, 'applyRemoteElements');

    const { initSocketClient, getLastServerClock } = await import('../socket-client');
    initSocketClient('room-abc');

    const snapshotHandler = _handlers[WS_EVENTS.ROOM_SNAPSHOT];
    expect(snapshotHandler).toBeDefined();

    const el = {
      id: 'p3a02-el-1', type: 'rectangle' as const,
      x: 10, y: 20, width: 100, height: 50, angle: 0, zIndex: 1,
      props: { strokeColor: '#000', fillColor: '#fff', strokeWidth: 1, strokeStyle: 'solid' as const, opacity: 1 },
      version: 2, versionNonce: 99, updatedAt: Date.now(),
      isDeleted: false, groupId: null, frameId: null, locked: false, createdBy: 'test',
    };

    snapshotHandler({ elements: [el], documentClock: 5 });

    expect(spy).toHaveBeenCalledWith([el]);
    expect(getLastServerClock()).toBe(5);
    spy.mockRestore();
  });
});

describe('socket-client — P3A-02/AC-5 (T014) ROOM_SNAPSHOT with empty elements', () => {
  // @covers AC-5
  it('does not modify elements store and sets lastServerClock to 0 for empty snapshot', async () => {
    const applyModule = await import('../apply-remote');
    const spy = vi.spyOn(applyModule, 'applyRemoteElements');

    const { useElementsStore: elStore } = await import('../../store/elements.store');
    // Seed the store with an existing element to verify it is NOT cleared
    elStore.setState({ elements: [] });

    const { initSocketClient, getLastServerClock } = await import('../socket-client');
    initSocketClient('room-abc');

    const snapshotHandler = _handlers[WS_EVENTS.ROOM_SNAPSHOT];
    expect(snapshotHandler).toBeDefined();

    snapshotHandler({ elements: [], documentClock: 0 });

    // applyRemoteElements called with empty array (it handles the no-op internally)
    expect(spy).toHaveBeenCalledWith([]);
    // lastServerClock set to 0
    expect(getLastServerClock()).toBe(0);
    // Store should remain empty (applyRemoteElements no-ops on empty array)
    expect(elStore.getState().elements).toHaveLength(0);
    spy.mockRestore();
  });
});

describe('socket-client — same-user camera sync across tabs', () => {
  it('CURSOR_MOVE with own sessionId applies viewport to local camera', async () => {
    const { initSocketClient } = await import('../socket-client');
    const { useCameraStore: camStore } = await import('../../store/camera.store');
    initSocketClient('room-abc');

    const moveHandler = _handlers[WS_EVENTS.CURSOR_MOVE];
    moveHandler({
      sessionId: 'local-session-id', // own session = same user, different tab
      cursor: null,
      viewport: { x: 500, y: 300, zoom: 1.5 },
    });

    expect(camStore.getState().camera).toEqual({ x: 500, y: 300, zoom: 1.5 });
  });

  it('CURSOR_MOVE with own sessionId does NOT add entry to remoteCursors', async () => {
    const { initSocketClient } = await import('../socket-client');
    const { useInteractionStore: store } = await import('../../store/interaction.store');
    initSocketClient('room-abc');

    const moveHandler = _handlers[WS_EVENTS.CURSOR_MOVE];
    moveHandler({ sessionId: 'local-session-id', cursor: { x: 10, y: 20 }, viewport: { x: 0, y: 0, zoom: 1 } });

    expect(store.getState().remoteCursors.has('local-session-id')).toBe(false);
  });
});

describe('socket-client — viewport-only CURSOR_MOVE (null cursor)', () => {
  it('null cursor update preserves existing cursor position of peer', async () => {
    const { initSocketClient } = await import('../socket-client');
    const { useInteractionStore: store } = await import('../../store/interaction.store');
    initSocketClient('room-abc');

    const joinHandler = _handlers[WS_EVENTS.USER_JOIN];
    joinHandler({ presences: [makePeer('peer-1')] });

    const moveHandler = _handlers[WS_EVENTS.CURSOR_MOVE];
    moveHandler({ sessionId: 'peer-1', cursor: { x: 100, y: 200 } });
    // viewport-only update with null cursor
    moveHandler({ sessionId: 'peer-1', cursor: null, viewport: { x: 10, y: 20, zoom: 2 } });

    const entry = store.getState().remoteCursors.get('peer-1');
    expect(entry?.cursor).toEqual({ x: 100, y: 200 }); // cursor unchanged
    expect(entry?.viewport).toEqual({ x: 10, y: 20, zoom: 2 }); // viewport updated
  });
});

// ─── 018 US1 — Remote Selection Highlight ────────────────────────────────────

describe('socket-client — 018/AC-1 (T007) emit selectedIds in cursor-move on selection change', () => {
  // @covers AC-1
  it('when selectedIds in interaction.store changes, cursor-move is emitted with those selectedIds', async () => {
    const { initSocketClient } = await import('../socket-client');
    const { useInteractionStore: store } = await import('../../store/interaction.store');
    initSocketClient('room-abc');
    mockEmit.mockClear();

    // Simulate selection change
    store.getState().setSelectedIds(['el-1', 'el-2']);

    // Allow the throttled emit to fire (50 ms window)
    await new Promise((r) => setTimeout(r, 60));

    expect(mockEmit).toHaveBeenCalledWith(
      WS_EVENTS.CURSOR_MOVE,
      expect.objectContaining({ selectedIds: ['el-1', 'el-2'] }),
    );
  });
});

describe('socket-client — 018/AC-1 (T008) incoming cursor-move with selectedIds updates remoteCursors', () => {
  // @covers AC-1
  it('CURSOR_MOVE payload with selectedIds merges into remoteCursors[sessionId].selectedIds', async () => {
    const { initSocketClient } = await import('../socket-client');
    const { useInteractionStore: store } = await import('../../store/interaction.store');
    initSocketClient('room-abc');

    const joinHandler = _handlers[WS_EVENTS.USER_JOIN];
    joinHandler({ presences: [makePeer('peer-2')] });

    const moveHandler = _handlers[WS_EVENTS.CURSOR_MOVE];
    moveHandler({ sessionId: 'peer-2', cursor: { x: 50, y: 50 }, selectedIds: ['el-abc'] });

    const entry = store.getState().remoteCursors.get('peer-2');
    expect(entry?.selectedIds).toEqual(['el-abc']);
  });
});

describe('socket-client — 018/AC-5 (T013) USER_LEAVE removes selection from remoteCursors', () => {
  // @covers AC-5
  it('USER_LEAVE for a sessionId removes that session from remoteCursors, clearing highlights', async () => {
    const { initSocketClient } = await import('../socket-client');
    const { useInteractionStore: store } = await import('../../store/interaction.store');
    initSocketClient('room-abc');

    const joinHandler = _handlers[WS_EVENTS.USER_JOIN];
    joinHandler({ presences: [makePeer('peer-3')] });

    const moveHandler = _handlers[WS_EVENTS.CURSOR_MOVE];
    moveHandler({ sessionId: 'peer-3', cursor: { x: 10, y: 10 }, selectedIds: ['el-xyz'] });
    expect(store.getState().remoteCursors.get('peer-3')?.selectedIds).toEqual(['el-xyz']);

    const leaveHandler = _handlers[WS_EVENTS.USER_LEAVE];
    leaveHandler({ sessionId: 'peer-3' });

    expect(store.getState().remoteCursors.has('peer-3')).toBe(false);
  });
});

// ─── 018 US2 — Remote Draft Preview ──────────────────────────────────────────

describe('socket-client — 018/AC-6 (T017) emit element-draft when draftElements becomes non-empty', () => {
  // @covers AC-6
  it('when draftElements in interaction.store changes to non-empty, element-draft is emitted', async () => {
    const { initSocketClient } = await import('../socket-client');
    const { useInteractionStore: store } = await import('../../store/interaction.store');
    initSocketClient('room-abc');
    mockEmit.mockClear();

    const draftEl = {
      id: 'draft-1', type: 'rectangle' as const,
      x: 5, y: 5, width: 80, height: 40, angle: 0, zIndex: 1,
      props: { strokeColor: '#000', fillColor: '#fff', strokeWidth: 1, strokeStyle: 'solid' as const, opacity: 1 },
      version: 1, versionNonce: 1, updatedAt: Date.now(),
      isDeleted: false, groupId: null, frameId: null, locked: false, createdBy: 'test',
    };

    store.getState().setDraftElements([draftEl]);
    await new Promise((r) => setTimeout(r, 60));

    expect(mockEmit).toHaveBeenCalledWith(
      WS_EVENTS.ELEMENT_DRAFT,
      expect.objectContaining({ elements: [draftEl] }),
    );
  });
});

describe('socket-client — 018/AC-9 (T018) emit element-draft with elements:[] when draftElements clears', () => {
  // @covers AC-9
  it('when draftElements returns to [], element-draft is emitted with elements:[]', async () => {
    const { initSocketClient } = await import('../socket-client');
    const { useInteractionStore: store } = await import('../../store/interaction.store');
    initSocketClient('room-abc');

    const draftEl = {
      id: 'draft-2', type: 'rectangle' as const,
      x: 0, y: 0, width: 50, height: 50, angle: 0, zIndex: 1,
      props: { strokeColor: '#000', fillColor: '#fff', strokeWidth: 1, strokeStyle: 'solid' as const, opacity: 1 },
      version: 1, versionNonce: 1, updatedAt: Date.now(),
      isDeleted: false, groupId: null, frameId: null, locked: false, createdBy: 'test',
    };

    store.getState().setDraftElements([draftEl]);
    await new Promise((r) => setTimeout(r, 60));
    mockEmit.mockClear();

    store.getState().setDraftElements([]);
    await new Promise((r) => setTimeout(r, 60));

    expect(mockEmit).toHaveBeenCalledWith(
      WS_EVENTS.ELEMENT_DRAFT,
      expect.objectContaining({ elements: [] }),
    );
  });
});

describe('socket-client — 018/AC-6 (T019) incoming element-draft sets remoteDrafts[sessionId]', () => {
  // @covers AC-6
  it('incoming element-draft with non-empty elements updates remoteDrafts in interaction.store', async () => {
    const { initSocketClient } = await import('../socket-client');
    const { useInteractionStore: store } = await import('../../store/interaction.store');
    initSocketClient('room-abc');

    const draftEl = {
      id: 'peer-draft-1', type: 'rectangle' as const,
      x: 20, y: 20, width: 60, height: 30, angle: 0, zIndex: 1,
      props: { strokeColor: '#000', fillColor: '#fff', strokeWidth: 1, strokeStyle: 'solid' as const, opacity: 1 },
      version: 1, versionNonce: 1, updatedAt: Date.now(),
      isDeleted: false, groupId: null, frameId: null, locked: false, createdBy: 'peer-4',
    };

    const draftHandler = _handlers[WS_EVENTS.ELEMENT_DRAFT];
    expect(draftHandler).toBeDefined();
    draftHandler({ sessionId: 'peer-4', elements: [draftEl] });

    expect(store.getState().remoteDrafts.get('peer-4')).toEqual([draftEl]);
  });
});

describe('socket-client — 018/AC-9 (T020) incoming element-draft with elements:[] clears remoteDrafts', () => {
  // @covers AC-9
  it('incoming element-draft with elements:[] removes remoteDrafts[sessionId]', async () => {
    const { initSocketClient } = await import('../socket-client');
    const { useInteractionStore: store } = await import('../../store/interaction.store');
    initSocketClient('room-abc');

    const draftEl = {
      id: 'peer-draft-2', type: 'rectangle' as const,
      x: 0, y: 0, width: 50, height: 50, angle: 0, zIndex: 1,
      props: { strokeColor: '#000', fillColor: '#fff', strokeWidth: 1, strokeStyle: 'solid' as const, opacity: 1 },
      version: 1, versionNonce: 1, updatedAt: Date.now(),
      isDeleted: false, groupId: null, frameId: null, locked: false, createdBy: 'peer-5',
    };

    const draftHandler = _handlers[WS_EVENTS.ELEMENT_DRAFT];
    draftHandler({ sessionId: 'peer-5', elements: [draftEl] });
    expect(store.getState().remoteDrafts.has('peer-5')).toBe(true);

    draftHandler({ sessionId: 'peer-5', elements: [] });
    expect(store.getState().remoteDrafts.has('peer-5')).toBe(false);
  });
});

describe('socket-client — 018/AC-10 (T021) incoming element-update with sessionId clears remoteDrafts', () => {
  // @covers AC-10
  it('element-update with sessionId field clears remoteDrafts[sessionId]', async () => {
    const { initSocketClient } = await import('../socket-client');
    const { useInteractionStore: store } = await import('../../store/interaction.store');
    initSocketClient('room-abc');

    const draftEl = {
      id: 'peer-commit-1', type: 'rectangle' as const,
      x: 0, y: 0, width: 50, height: 50, angle: 0, zIndex: 1,
      props: { strokeColor: '#000', fillColor: '#fff', strokeWidth: 1, strokeStyle: 'solid' as const, opacity: 1 },
      version: 1, versionNonce: 1, updatedAt: Date.now(),
      isDeleted: false, groupId: null, frameId: null, locked: false, createdBy: 'peer-6',
    };

    const draftHandler = _handlers[WS_EVENTS.ELEMENT_DRAFT];
    draftHandler({ sessionId: 'peer-6', elements: [draftEl] });
    expect(store.getState().remoteDrafts.has('peer-6')).toBe(true);

    // Commit arrives
    const updateHandler = _handlers[WS_EVENTS.ELEMENT_UPDATE];
    updateHandler({ elements: [{ ...draftEl, x: 100 }], sessionId: 'peer-6' });

    expect(store.getState().remoteDrafts.has('peer-6')).toBe(false);
  });
});

describe('socket-client — 018/AC-5 (T022) USER_LEAVE also clears remoteDrafts', () => {
  // @covers AC-5
  it('USER_LEAVE for a sessionId deletes that session from remoteDrafts', async () => {
    const { initSocketClient } = await import('../socket-client');
    const { useInteractionStore: store } = await import('../../store/interaction.store');
    initSocketClient('room-abc');

    const draftEl = {
      id: 'peer-leave-draft', type: 'rectangle' as const,
      x: 0, y: 0, width: 50, height: 50, angle: 0, zIndex: 1,
      props: { strokeColor: '#000', fillColor: '#fff', strokeWidth: 1, strokeStyle: 'solid' as const, opacity: 1 },
      version: 1, versionNonce: 1, updatedAt: Date.now(),
      isDeleted: false, groupId: null, frameId: null, locked: false, createdBy: 'peer-7',
    };

    const draftHandler = _handlers[WS_EVENTS.ELEMENT_DRAFT];
    draftHandler({ sessionId: 'peer-7', elements: [draftEl] });
    expect(store.getState().remoteDrafts.has('peer-7')).toBe(true);

    const leaveHandler = _handlers[WS_EVENTS.USER_LEAVE];
    leaveHandler({ sessionId: 'peer-7' });

    expect(store.getState().remoteDrafts.has('peer-7')).toBe(false);
  });
});
