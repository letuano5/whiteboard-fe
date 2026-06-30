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

beforeEach(() => {
  mocks.calls.length = 0;
  mocks.initAuth.mockClear();
  mocks.initHistoryCapture.mockClear();
  mocks.loadCamera.mockClear();
  mocks.startCameraPersistence.mockClear();
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

    expect(mocks.calls).toEqual(['history', 'auth']);
    expect(mocks.loadCamera).not.toHaveBeenCalled();
    expect(mocks.startCameraPersistence).not.toHaveBeenCalled();
    expect(mocks.initSocketClient).not.toHaveBeenCalled();
  });
});
