import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapApp } from '../../app/bootstrap';

const mocks = vi.hoisted(() => ({
  initLocalStoragePersistence: vi.fn(),
  startLocalStoragePersistence: vi.fn(),
  initBroadcastChannel: vi.fn(),
  initSocketClient: vi.fn(),
  loadCamera: vi.fn(),
  startCameraPersistence: vi.fn(),
  initHistoryCapture: vi.fn(),
  initAuth: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../sync/local-storage', () => ({
  initLocalStoragePersistence: mocks.initLocalStoragePersistence,
  startLocalStoragePersistence: mocks.startLocalStoragePersistence,
}));

vi.mock('../../sync/broadcast-channel', () => ({
  initBroadcastChannel: mocks.initBroadcastChannel,
}));

vi.mock('../../sync/socket-client', () => ({
  initSocketClient: mocks.initSocketClient,
}));

vi.mock('../../sync/camera-persistence', () => ({
  loadCamera: mocks.loadCamera,
  startCameraPersistence: mocks.startCameraPersistence,
}));

vi.mock('../../sync/history-capture', () => ({
  initHistoryCapture: mocks.initHistoryCapture,
}));

vi.mock('../../auth/auth.store', () => ({
  useAuthStore: {
    getState: () => ({
      initAuth: mocks.initAuth,
    }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('bootstrapApp local board mode', () => {
  it('starts localStorage and BroadcastChannel without Socket.IO when room id is empty', async () => {
    // @covers AC-2
    // @covers AC-3
    // @covers AC-4
    await bootstrapApp('');

    expect(mocks.initHistoryCapture).toHaveBeenCalledOnce();
    expect(mocks.initAuth).toHaveBeenCalledOnce();
    expect(mocks.initLocalStoragePersistence).toHaveBeenCalledOnce();
    expect(mocks.startLocalStoragePersistence).toHaveBeenCalledOnce();
    expect(mocks.initBroadcastChannel).toHaveBeenCalledOnce();
    expect(mocks.initSocketClient).not.toHaveBeenCalled();
    expect(mocks.loadCamera).not.toHaveBeenCalled();
    expect(mocks.startCameraPersistence).not.toHaveBeenCalled();
  });

  it('starts saved-room camera and Socket.IO without local-only persistence for room id', async () => {
    // @covers AC-4
    // @covers AC-6
    await bootstrapApp('room-123');

    expect(mocks.loadCamera).toHaveBeenCalledWith('room-123');
    expect(mocks.startCameraPersistence).toHaveBeenCalledWith('room-123');
    expect(mocks.initSocketClient).toHaveBeenCalledWith('room-123');
    expect(mocks.initLocalStoragePersistence).not.toHaveBeenCalled();
    expect(mocks.startLocalStoragePersistence).not.toHaveBeenCalled();
    expect(mocks.initBroadcastChannel).not.toHaveBeenCalled();
  });
});
