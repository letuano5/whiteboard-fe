import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const IDENTITY_KEY = 'VDT_USER_IDENTITY';

// localStorage mock
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
};
vi.stubGlobal('localStorage', localStorageMock);

// crypto.randomUUID mock — deterministic for tests
vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'test-uuid-1234') });

beforeEach(() => {
  localStorageMock.clear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LOCAL_PRESENCE identity persistence', () => {
  it('generates a new identity and saves it when localStorage is empty', async () => {
    const { LOCAL_PRESENCE } = await import('../presence');
    expect(LOCAL_PRESENCE.sessionId).toBe('test-uuid-1234');
    expect(typeof LOCAL_PRESENCE.name).toBe('string');
    expect(typeof LOCAL_PRESENCE.color).toBe('string');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      IDENTITY_KEY,
      expect.stringContaining('test-uuid-1234'),
    );
  });

  it('loads existing identity from localStorage and does not overwrite it', async () => {
    const saved = { sessionId: 'existing-id', name: 'Red Bear', color: '#ef4444' };
    store[IDENTITY_KEY] = JSON.stringify(saved);

    const { LOCAL_PRESENCE } = await import('../presence');

    expect(LOCAL_PRESENCE.sessionId).toBe('existing-id');
    expect(LOCAL_PRESENCE.name).toBe('Red Bear');
    expect(LOCAL_PRESENCE.color).toBe('#ef4444');
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });

  it('generates a new identity when localStorage contains corrupted JSON', async () => {
    store[IDENTITY_KEY] = '{invalid json';

    const { LOCAL_PRESENCE } = await import('../presence');

    expect(LOCAL_PRESENCE.sessionId).toBe('test-uuid-1234');
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('generates a new identity when stored object is missing required fields', async () => {
    store[IDENTITY_KEY] = JSON.stringify({ sessionId: 'only-id' }); // missing name and color

    const { LOCAL_PRESENCE } = await import('../presence');

    expect(LOCAL_PRESENCE.sessionId).toBe('test-uuid-1234');
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('same identity is returned on every import within the same module instance', async () => {
    const { LOCAL_PRESENCE: a } = await import('../presence');
    const { LOCAL_PRESENCE: b } = await import('../presence');
    expect(a).toBe(b);
  });
});
