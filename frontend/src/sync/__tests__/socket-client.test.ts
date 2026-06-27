import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WS_EVENTS } from '../../types/shared';
import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import type { Presence } from '../../types/shared';

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
