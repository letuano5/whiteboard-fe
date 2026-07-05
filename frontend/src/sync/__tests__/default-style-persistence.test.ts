import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  STORAGE_KEY,
  initDefaultStylePersistence,
  startDefaultStylePersistence,
} from '../default-style-persistence';
import { useDefaultStyleStore, DEFAULT_STYLE_INITIAL } from '../../store/default-style.store';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  }),
};
vi.stubGlobal('localStorage', localStorageMock);

beforeEach(() => {
  localStorageMock.clear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  useDefaultStyleStore.setState({ ...DEFAULT_STYLE_INITIAL });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('initDefaultStylePersistence', () => {
  it('applies saved default style to the store when valid data exists', () => {
    store[STORAGE_KEY] = JSON.stringify({
      strokeColor: '#ff0000',
      fillColor: '#00ff00',
      strokeWidth: 6,
      strokeStyle: 'dashed',
      opacity: 0.4,
    });

    initDefaultStylePersistence();

    expect(useDefaultStyleStore.getState()).toMatchObject({
      strokeColor: '#ff0000',
      fillColor: '#00ff00',
      strokeWidth: 6,
      strokeStyle: 'dashed',
      opacity: 0.4,
    });
  });

  it('leaves store unchanged when localStorage key does not exist', () => {
    initDefaultStylePersistence();
    expect(useDefaultStyleStore.getState()).toMatchObject(DEFAULT_STYLE_INITIAL);
  });

  it('leaves store unchanged when stored JSON is corrupted', () => {
    store[STORAGE_KEY] = '{bad json';
    initDefaultStylePersistence();
    expect(useDefaultStyleStore.getState()).toMatchObject(DEFAULT_STYLE_INITIAL);
  });

  it('leaves store unchanged when stored object is missing required fields', () => {
    store[STORAGE_KEY] = JSON.stringify({ strokeColor: '#ff0000' });
    initDefaultStylePersistence();
    expect(useDefaultStyleStore.getState()).toMatchObject(DEFAULT_STYLE_INITIAL);
  });

  it('leaves store unchanged when strokeStyle is not a recognized value', () => {
    store[STORAGE_KEY] = JSON.stringify({
      strokeColor: '#ff0000',
      fillColor: '#00ff00',
      strokeWidth: 6,
      strokeStyle: 'squiggly',
      opacity: 0.4,
    });
    initDefaultStylePersistence();
    expect(useDefaultStyleStore.getState()).toMatchObject(DEFAULT_STYLE_INITIAL);
  });
});

describe('startDefaultStylePersistence', () => {
  it('writes to localStorage after debounce when the default style changes', () => {
    const stop = startDefaultStylePersistence();

    useDefaultStyleStore.getState().setDefaultStyle({ strokeColor: '#123456' });
    expect(localStorageMock.setItem).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(saved).toMatchObject({ strokeColor: '#123456' });

    stop();
  });

  it('debounces rapid changes — only writes once after the last change', () => {
    const stop = startDefaultStylePersistence();

    useDefaultStyleStore.getState().setDefaultStyle({ strokeWidth: 1 });
    vi.advanceTimersByTime(100);
    useDefaultStyleStore.getState().setDefaultStyle({ strokeWidth: 2 });
    vi.advanceTimersByTime(100);
    useDefaultStyleStore.getState().setDefaultStyle({ strokeWidth: 3 });
    vi.advanceTimersByTime(300);

    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(saved.strokeWidth).toBe(3);

    stop();
  });

  it('stops writing after the returned cleanup function is called', () => {
    const stop = startDefaultStylePersistence();
    stop();

    useDefaultStyleStore.getState().setDefaultStyle({ strokeWidth: 9 });
    vi.advanceTimersByTime(500);

    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });
});
