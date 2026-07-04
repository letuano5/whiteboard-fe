import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapApp } from '../bootstrap';

const mocks = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    initAuth: vi.fn(async () => {
      calls.push('auth');
    }),
    initHistoryCapture: vi.fn(() => {
      calls.push('history');
    }),
    loadCamera: vi.fn(() => {
      calls.push('load-camera');
    }),
    startCameraPersistence: vi.fn(() => {
      calls.push('camera-persistence');
    }),
    initLocalStoragePersistence: vi.fn(() => {
      calls.push('local-storage-init');
    }),
    startLocalStoragePersistence: vi.fn(() => {
      calls.push('local-storage-start');
    }),
    initBroadcastChannel: vi.fn(() => {
      calls.push('broadcast');
    }),
    initSocketClient: vi.fn(() => {
      calls.push('socket');
    }),
  };
});

vi.mock('../../auth/auth.store', () => ({
  useAuthStore: {
    getState: () => ({
      initAuth: mocks.initAuth,
    }),
  },
}));

vi.mock('../../sync/history-capture', () => ({
  initHistoryCapture: mocks.initHistoryCapture,
}));

vi.mock('../../sync/camera-persistence', () => ({
  loadCamera: mocks.loadCamera,
  startCameraPersistence: mocks.startCameraPersistence,
}));

vi.mock('../../sync/socket-client', () => ({
  initSocketClient: mocks.initSocketClient,
}));

vi.mock('../../sync/local-storage', () => ({
  initLocalStoragePersistence: mocks.initLocalStoragePersistence,
  startLocalStoragePersistence: mocks.startLocalStoragePersistence,
}));

vi.mock('../../sync/broadcast-channel', () => ({
  initBroadcastChannel: mocks.initBroadcastChannel,
}));

beforeEach(() => {
  mocks.calls.length = 0;
  mocks.initAuth.mockClear();
  mocks.initHistoryCapture.mockClear();
  mocks.loadCamera.mockClear();
  mocks.startCameraPersistence.mockClear();
  mocks.initLocalStoragePersistence.mockClear();
  mocks.startLocalStoragePersistence.mockClear();
  mocks.initBroadcastChannel.mockClear();
  mocks.initSocketClient.mockClear();
});

describe('bootstrapApp', () => {
  it('restores auth before initializing a room socket connection', async () => {
    await bootstrapApp('room-abc');

    expect(mocks.calls).toEqual(['history', 'auth', 'load-camera', 'camera-persistence', 'socket']);
    expect(mocks.initSocketClient).toHaveBeenCalledWith('room-abc');
  });

  it('does not initialize camera or socket when no room is open', async () => {
    await bootstrapApp('');

    expect(mocks.calls).toEqual([
      'history',
      'auth',
      'local-storage-init',
      'local-storage-start',
      'broadcast',
    ]);
    expect(mocks.loadCamera).not.toHaveBeenCalled();
    expect(mocks.startCameraPersistence).not.toHaveBeenCalled();
    expect(mocks.initSocketClient).not.toHaveBeenCalled();
  });

  it('restores auth only for the dashboard route', async () => {
    // @covers AC-1
    await bootstrapApp('', { route: 'dashboard' });

    expect(mocks.calls).toEqual(['auth']);
    expect(mocks.initHistoryCapture).not.toHaveBeenCalled();
    expect(mocks.initLocalStoragePersistence).not.toHaveBeenCalled();
    expect(mocks.initBroadcastChannel).not.toHaveBeenCalled();
    expect(mocks.initSocketClient).not.toHaveBeenCalled();
  });
});
