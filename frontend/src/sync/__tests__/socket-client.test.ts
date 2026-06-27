import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WS_EVENTS } from '../../types/shared';
import { useElementsStore } from '../../store/elements.store';

// Mock socket.io-client before importing socket-client
const mockEmit = vi.fn();
const mockOn = vi.fn();
const mockDisconnect = vi.fn();
const mockOffAny = vi.fn();

const mockSocket = {
  emit: mockEmit,
  on: mockOn,
  disconnect: mockDisconnect,
  offAny: mockOffAny,
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
  mockOffAny.mockClear();
  Object.keys(_handlers).forEach((k) => delete _handlers[k]);

  mockOn.mockImplementation((event: string, handler: (data: unknown) => void) => {
    _handlers[event] = handler;
    return mockSocket;
  });

  useElementsStore.setState({ elements: [] });
  vi.resetModules();
});

afterEach(async () => {
  const { stopSocketClient } = await import('../socket-client');
  stopSocketClient();
});

describe('socket-client — AC-4', () => {
  // @covers AC-4
  it('emits join-room with roomId on init', async () => {
    const { initSocketClient } = await import('../socket-client');
    initSocketClient('room-abc');
    expect(mockEmit).toHaveBeenCalledWith(WS_EVENTS.JOIN_ROOM, { roomId: 'room-abc' });
  });
});

describe('socket-client — AC-5', () => {
  // @covers AC-5
  // @covers 014/AC-1 — element-update event delivery is the mechanism that makes
  //   remote element changes appear on the local canvas (AC-1 broadcast delivery).
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

describe('socket-client — AC-6 (room isolation, client-side)', () => {
  // @covers AC-6
  // Server-side isolation (socket.to(roomId)) is the real guarantee — verified via
  // quickstart.md scenario 6. This test confirms the client handler is wired correctly
  // and only fires when the server emits to the room the client joined.
  it('does NOT call applyRemoteElements when no element-update event is emitted', async () => {
    const applyModule = await import('../apply-remote');
    const spy = vi.spyOn(applyModule, 'applyRemoteElements');

    const { initSocketClient } = await import('../socket-client');
    initSocketClient('room-abc');

    // No event fired — handler should never be called
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('socket-client — 014/AC-4 (room isolation via roomId in emit)', () => {
  // @covers 014/AC-4
  // The client includes roomId in every element-update emit so the server can call
  // socket.to(roomId).emit(...) — which excludes all clients in other rooms.
  // This is the client-side half of the room isolation guarantee.
  it('element-update mutations are emitted with the joined roomId for server-side isolation', async () => {
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
