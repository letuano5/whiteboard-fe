import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadCamera, saveCamera, startCameraPersistence } from '../camera-persistence';
import { useCameraStore } from '../../store/camera.store';

const CAMERA_KEY = (roomId: string) => `VDT_CAMERA_${roomId}`;

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
};
vi.stubGlobal('localStorage', localStorageMock);

beforeEach(() => {
  localStorageMock.clear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  useCameraStore.setState({ camera: { x: 0, y: 0, zoom: 1 } });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('loadCamera', () => {
  it('applies saved camera to store when valid data exists', () => {
    store[CAMERA_KEY('room-1')] = JSON.stringify({ x: 100, y: 200, zoom: 2 });
    loadCamera('room-1');
    expect(useCameraStore.getState().camera).toEqual({ x: 100, y: 200, zoom: 2 });
  });

  it('leaves store unchanged when localStorage key does not exist', () => {
    loadCamera('room-1');
    expect(useCameraStore.getState().camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('leaves store unchanged when stored JSON is corrupted', () => {
    store[CAMERA_KEY('room-1')] = '{bad json';
    loadCamera('room-1');
    expect(useCameraStore.getState().camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('leaves store unchanged when stored object is missing required fields', () => {
    store[CAMERA_KEY('room-1')] = JSON.stringify({ x: 50 }); // missing y and zoom
    loadCamera('room-1');
    expect(useCameraStore.getState().camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('uses room-scoped key so different rooms do not interfere', () => {
    store[CAMERA_KEY('room-A')] = JSON.stringify({ x: 10, y: 20, zoom: 1.5 });
    store[CAMERA_KEY('room-B')] = JSON.stringify({ x: 99, y: 88, zoom: 0.5 });

    loadCamera('room-A');
    expect(useCameraStore.getState().camera).toEqual({ x: 10, y: 20, zoom: 1.5 });

    useCameraStore.setState({ camera: { x: 0, y: 0, zoom: 1 } });
    loadCamera('room-B');
    expect(useCameraStore.getState().camera).toEqual({ x: 99, y: 88, zoom: 0.5 });
  });
});

describe('saveCamera', () => {
  it('writes camera to the correct room-scoped key', () => {
    saveCamera('room-1', { x: 50, y: 75, zoom: 1.5 });
    const saved = JSON.parse(store[CAMERA_KEY('room-1')]);
    expect(saved).toEqual({ x: 50, y: 75, zoom: 1.5 });
  });
});

describe('startCameraPersistence', () => {
  it('writes to localStorage after debounce when camera changes', () => {
    const stop = startCameraPersistence('room-1');

    useCameraStore.getState().setCamera({ x: 300, y: 400, zoom: 2 });
    expect(localStorageMock.setItem).not.toHaveBeenCalled(); // not yet

    vi.advanceTimersByTime(300);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      CAMERA_KEY('room-1'),
      JSON.stringify({ x: 300, y: 400, zoom: 2 }),
    );

    stop();
  });

  it('debounces rapid changes — only writes once after the last change', () => {
    const stop = startCameraPersistence('room-1');

    useCameraStore.getState().setCamera({ x: 1, y: 1, zoom: 1 });
    vi.advanceTimersByTime(100);
    useCameraStore.getState().setCamera({ x: 2, y: 2, zoom: 1 });
    vi.advanceTimersByTime(100);
    useCameraStore.getState().setCamera({ x: 3, y: 3, zoom: 1 });
    vi.advanceTimersByTime(300);

    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(saved).toEqual({ x: 3, y: 3, zoom: 1 });

    stop();
  });

  it('stops writing after the returned cleanup function is called', () => {
    const stop = startCameraPersistence('room-1');
    stop();

    useCameraStore.getState().setCamera({ x: 99, y: 99, zoom: 3 });
    vi.advanceTimersByTime(500);

    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });
});
