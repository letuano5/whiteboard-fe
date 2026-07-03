import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  STORAGE_KEY,
  initLocalStoragePersistence,
  startLocalStoragePersistence,
} from '../local-storage';
import { useElementsStore } from '../../store/elements.store';
import { useCameraStore } from '../../store/camera.store';
import { createElement } from '../../store/mutation-pipeline';
import type { Element } from '../../types/shared';
import {
  onHighlighterPointerDown,
  onHighlighterPointerMove,
  onHighlighterPointerUp,
} from '../../canvas/tools/freehand-tool';

// Vitest's jsdom shim only exposes setItem/getItem; stub with a full implementation.
function makeLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    _reset: () => {
      store = {};
    },
  };
}

const localStorageMock = makeLocalStorageMock();
vi.stubGlobal('localStorage', localStorageMock);

const DEFAULT_CAMERA = { x: 0, y: 0, zoom: 1 };

function makeStoredElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'el-stored-1',
    type: 'rectangle',
    x: 20,
    y: 30,
    width: 120,
    height: 60,
    angle: 0,
    zIndex: 1,
    props: {
      strokeColor: '#ff0000',
      fillColor: '#00ff00',
      strokeWidth: 3,
      strokeStyle: 'dashed',
      opacity: 0.8,
    },
    version: 5,
    versionNonce: 98765,
    updatedAt: 1700000000000,
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'user-abc',
    ...overrides,
  };
}

beforeEach(() => {
  localStorageMock._reset();
  useElementsStore.setState({ elements: [] });
  useCameraStore.getState().resetCamera();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('initLocalStoragePersistence — elements restore', () => {
  // @covers AC-1 (006-localstorage-zorder)
  it('restores all non-deleted shapes with correct properties after reload', () => {
    const stored = makeStoredElement();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ elements: [stored], camera: DEFAULT_CAMERA }),
    );

    initLocalStoragePersistence();

    const { elements } = useElementsStore.getState();
    expect(elements).toHaveLength(1);
    expect(elements[0].id).toBe('el-stored-1');
    expect(elements[0].type).toBe('rectangle');
    expect(elements[0].x).toBe(20);
    expect(elements[0].y).toBe(30);
    expect(elements[0].props.strokeColor).toBe('#ff0000');
    expect(elements[0].props.fillColor).toBe('#00ff00');
  });

  // @covers AC-3 (006-localstorage-zorder)
  it('retains soft-deleted element in store but it is filtered from canvas view', () => {
    const deleted = makeStoredElement({ isDeleted: true });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ elements: [deleted], camera: DEFAULT_CAMERA }),
    );

    initLocalStoragePersistence();

    const { elements } = useElementsStore.getState();
    expect(elements).toHaveLength(1);
    expect(elements[0].isDeleted).toBe(true);
    // renderer-side filter: only non-deleted are visible
    const visible = elements.filter((e) => !e.isDeleted);
    expect(visible).toHaveLength(0);
  });
});

describe('initLocalStoragePersistence — camera restore', () => {
  // @covers AC-2 (006-localstorage-zorder)
  it('restores camera x, y, and zoom to stored values after reload', () => {
    const storedCamera = { x: 100, y: 200, zoom: 1.5 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ elements: [], camera: storedCamera }));

    initLocalStoragePersistence();

    const { camera } = useCameraStore.getState();
    expect(camera.x).toBe(100);
    expect(camera.y).toBe(200);
    expect(camera.zoom).toBe(1.5);
  });
});

describe('initLocalStoragePersistence — empty / corrupt storage', () => {
  // @covers AC-5 (006-localstorage-zorder)
  it('initialises empty canvas with default camera when no data exists', () => {
    // localStorage is empty (cleared in beforeEach)
    initLocalStoragePersistence();

    expect(useElementsStore.getState().elements).toHaveLength(0);
    const { camera } = useCameraStore.getState();
    expect(camera).toEqual(DEFAULT_CAMERA);
  });

  // @covers AC-6 (006-localstorage-zorder)
  it('falls back to empty canvas without throwing when stored data is invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{invalid json');

    expect(() => initLocalStoragePersistence()).not.toThrow();
    expect(useElementsStore.getState().elements).toHaveLength(0);
    const { camera } = useCameraStore.getState();
    expect(camera).toEqual(DEFAULT_CAMERA);
  });

  it('falls back to empty canvas without throwing when stored data has wrong shape', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ notElements: true }));

    expect(() => initLocalStoragePersistence()).not.toThrow();
    expect(useElementsStore.getState().elements).toHaveLength(0);
  });
});

describe('initLocalStoragePersistence — full field round-trip', () => {
  // @covers AC-7 (006-localstorage-zorder)
  it('restores every field of an element faithfully', () => {
    const full: Element = {
      id: 'full-el',
      type: 'ellipse',
      x: 11,
      y: 22,
      width: 333,
      height: 444,
      angle: 0,
      zIndex: 7,
      props: {
        strokeColor: '#aabbcc',
        fillColor: '#112233',
        strokeWidth: 4,
        strokeStyle: 'dotted',
        opacity: 0.5,
        text: 'hello',
        fontSize: 16,
        fontFamily: 'serif',
        textAlign: 'right',
      },
      version: 9,
      versionNonce: 55555,
      updatedAt: 1234567890123,
      isDeleted: false,
      groupId: 'g-1',
      frameId: 'f-2',
      locked: true,
      createdBy: 'owner-xyz',
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ elements: [full], camera: DEFAULT_CAMERA }));

    initLocalStoragePersistence();

    const restored = useElementsStore.getState().elements[0];
    expect(restored).toEqual(full);
  });
});

describe('startLocalStoragePersistence — debounce write', () => {
  // @covers AC-4 (006-localstorage-zorder)
  it('persists a created element after the 300 ms debounce window', () => {
    vi.useFakeTimers();
    const cleanup = startLocalStoragePersistence();

    createElement({
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      angle: 0,
      props: {
        strokeColor: '#000',
        fillColor: '#fff',
        strokeWidth: 1,
        strokeStyle: 'solid',
        opacity: 1,
      },
      groupId: null,
      frameId: null,
      locked: false,
      createdBy: 'test',
    });

    // Before debounce fires: nothing written yet
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    // Advance past the 300 ms debounce
    vi.advanceTimersByTime(300);

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.elements).toHaveLength(1);
    expect(parsed.camera).toEqual(DEFAULT_CAMERA);

    cleanup();
  });

  // @covers AC-13 (008-rotate-resize)
  it('persists an element with angle ≠ 0 and restores it correctly', () => {
    vi.useFakeTimers();
    const cleanup = startLocalStoragePersistence();

    createElement({
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      angle: Math.PI / 4,
      props: {
        strokeColor: '#000',
        fillColor: '#fff',
        strokeWidth: 1,
        strokeStyle: 'solid',
        opacity: 1,
      },
      groupId: null,
      frameId: null,
      locked: false,
      createdBy: 'test',
    });

    vi.advanceTimersByTime(300);

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.elements[0].angle).toBeCloseTo(Math.PI / 4);

    // Simulate reload: clear store, restore from localStorage
    useElementsStore.setState({ elements: [] });
    initLocalStoragePersistence();
    const restored = useElementsStore.getState().elements[0];
    expect(restored.angle).toBeCloseTo(Math.PI / 4);

    cleanup();
  });

  it('does not write before the debounce window expires', () => {
    vi.useFakeTimers();
    const cleanup = startLocalStoragePersistence();

    createElement({
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      angle: 0,
      props: {
        strokeColor: '#000',
        fillColor: '#fff',
        strokeWidth: 1,
        strokeStyle: 'solid',
        opacity: 1,
      },
      groupId: null,
      frameId: null,
      locked: false,
      createdBy: 'test',
    });

    vi.advanceTimersByTime(299);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    cleanup();
  });

  it('persists a drawn highlighter stroke and restores it after reload', () => {
    vi.useFakeTimers();
    const cleanup = startLocalStoragePersistence();

    onHighlighterPointerDown({ x: 0, y: 0 });
    onHighlighterPointerMove({ x: 10, y: 20 });
    onHighlighterPointerUp({ x: 20, y: 0 });

    vi.advanceTimersByTime(300);

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!);
    expect(saved.elements).toHaveLength(1);
    expect(saved.elements[0]).toMatchObject({
      type: 'highlighter',
      props: {
        opacity: 0.35,
        strokeWidth: 14,
        points: [
          [0, 0],
          [10, 20],
          [20, 0],
        ],
      },
    });

    useElementsStore.setState({ elements: [] });
    initLocalStoragePersistence();

    const restored = useElementsStore.getState().elements[0];
    expect(restored).toMatchObject({
      type: 'highlighter',
      x: 0,
      y: 0,
      width: 20,
      height: 20,
    });
    expect(restored.props.points).toEqual([
      [0, 0],
      [10, 20],
      [20, 0],
    ]);

    cleanup();
  });
});
