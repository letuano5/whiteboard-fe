import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LoginToSave } from '../LoginToSave';
import { useAuthStore, type AuthStoreState } from '../../auth/auth.store';
import { useCameraStore } from '../../store/camera.store';
import { useElementsStore } from '../../store/elements.store';
import type { Element } from '../../types/shared';
import { saveLocalBoard } from '../local-board-save';
import { saveCamera } from '../../sync/camera-persistence';
import { STORAGE_KEY } from '../../sync/local-storage';

vi.mock('../local-board-save', () => ({
  saveLocalBoard: vi.fn(),
}));

vi.mock('../../sync/camera-persistence', () => ({
  saveCamera: vi.fn(),
}));

vi.mock('../../auth/AuthPanel', () => ({
  AuthPanel: () => <div data-testid="auth-panel" />,
}));

const mockPushState = vi.fn();
const mockReload = vi.fn();

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

const element: Element = {
  id: 'local-el-1',
  type: 'rectangle',
  x: 10,
  y: 20,
  width: 100,
  height: 60,
  angle: 0,
  zIndex: 7,
  props: {
    strokeColor: '#111111',
    fillColor: '#ffffff',
    strokeWidth: 2,
    strokeStyle: 'solid',
    opacity: 1,
  },
  version: 4,
  versionNonce: 123,
  updatedAt: 1700000000000,
  isDeleted: false,
  groupId: null,
  frameId: null,
  locked: false,
  createdBy: 'anonymous',
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock._reset();
  useElementsStore.setState({ elements: [element] });
  useCameraStore.setState({ camera: { x: 11, y: 22, zoom: 1.5 } });
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ elements: [element], camera: { x: 1, y: 2, zoom: 1 } }),
  );
  Object.defineProperty(window, 'history', {
    value: { ...window.history, pushState: mockPushState },
    writable: true,
  });
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: mockReload },
    writable: true,
  });
});

function setAuthState(state: Partial<AuthStoreState>) {
  useAuthStore.setState({
    session: null,
    status: 'anonymous',
    errorMessage: null,
    noticeMessage: null,
    initAuth: vi.fn(),
    refreshSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signUpWithPassword: vi.fn(),
    signOut: vi.fn(),
    ...state,
  });
}

describe('LoginToSave', () => {
  it('shows the auth flow without clearing current local board data', () => {
    // @covers AC-7
    // @covers AC-11
    setAuthState({ session: null, status: 'anonymous' });

    render(<LoginToSave />);
    fireEvent.click(screen.getByRole('button', { name: /login to save/i }));

    expect(screen.getByTestId('auth-panel')).toBeInTheDocument();
    expect(useElementsStore.getState().elements).toEqual([element]);
  });

  it('auto-saves after the login flow produces a session', async () => {
    // @covers AC-7
    // @covers AC-8
    vi.mocked(saveLocalBoard).mockResolvedValue({ roomId: 'room-new' });
    setAuthState({ session: null, status: 'anonymous' });

    render(<LoginToSave />);
    fireEvent.click(screen.getByRole('button', { name: /login to save/i }));

    setAuthState({
      session: {
        accessToken: 'token',
        expiresAt: null,
        user: { id: 'user-1', email: 'user@example.com', name: null, avatarUrl: null },
      },
      status: 'authenticated',
    });

    await waitFor(() => {
      expect(saveLocalBoard).toHaveBeenCalledWith({
        elements: [element],
        camera: { x: 11, y: 22, zoom: 1.5 },
      });
    });
  });

  it('saves current elements and camera, clears local scene, then opens the saved room', async () => {
    // @covers AC-8
    // @covers AC-9
    vi.mocked(saveLocalBoard).mockResolvedValue({ roomId: 'room-new' });
    setAuthState({
      session: {
        accessToken: 'token',
        expiresAt: null,
        user: { id: 'user-1', email: 'user@example.com', name: null, avatarUrl: null },
      },
      status: 'authenticated',
    });

    render(<LoginToSave />);
    fireEvent.click(screen.getByRole('button', { name: /save board/i }));

    await waitFor(() => {
      expect(saveLocalBoard).toHaveBeenCalledWith({
        elements: [element],
        camera: { x: 11, y: 22, zoom: 1.5 },
      });
    });
    expect(saveCamera).toHaveBeenCalledWith('room-new', { x: 11, y: 22, zoom: 1.5 });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(mockPushState).toHaveBeenCalledWith({}, '', '/?room=room-new');
    expect(mockReload).toHaveBeenCalledOnce();
  });

  it('shows a save error and keeps local board data intact when save fails', async () => {
    // @covers AC-11
    vi.mocked(saveLocalBoard).mockRejectedValue(new Error('Could not persist room.'));
    setAuthState({
      session: {
        accessToken: 'token',
        expiresAt: null,
        user: { id: 'user-1', email: 'user@example.com', name: null, avatarUrl: null },
      },
      status: 'authenticated',
    });

    render(<LoginToSave />);
    fireEvent.click(screen.getByRole('button', { name: /save board/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not persist room.');
    expect(mockPushState).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(useElementsStore.getState().elements).toEqual([element]);
  });
});
