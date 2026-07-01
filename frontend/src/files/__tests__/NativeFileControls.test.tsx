import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Element, NativeFileDocument } from '../../types/shared';
import { useCameraStore } from '../../store/camera.store';
import { useElementsStore } from '../../store/elements.store';
import { NativeFileControls } from '../NativeFileControls';
import { buildNativeFileDocument, serializeNativeFile } from '../native-file';
import { importNativeFileToRoom } from '../file-lifecycle-api';

vi.mock('../file-lifecycle-api', () => ({
  importNativeFileToRoom: vi.fn(),
}));

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
  };
}

const localStorageMock = makeLocalStorageMock();
vi.stubGlobal('localStorage', localStorageMock);

const existingElement = makeElement({ id: 'existing', zIndex: 1 });
const importedElement = makeElement({
  id: 'imported',
  type: 'text',
  zIndex: 2,
  props: {
    strokeColor: '#111111',
    fillColor: '#ffffff',
    strokeWidth: 2,
    strokeStyle: 'solid',
    opacity: 1,
    text: 'Imported',
    fontSize: 18,
    fontFamily: 'Inter',
    textAlign: 'left',
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem('VDT_WHITEBOARD_SCENE');
  useElementsStore.setState({ elements: [existingElement] });
  useCameraStore.setState({ camera: { x: 1, y: 2, zoom: 1 } });
  vi.mocked(importNativeFileToRoom).mockResolvedValue({
    importedElementCount: 1,
    documentClock: '2',
  });
});

describe('NativeFileControls', () => {
  it('requires confirmation before replacing a non-empty local board and keeps import local-only', async () => {
    // @covers AC-2
    // @covers AC-5
    const nativeDocument = makeNativeDocument('local');
    const { container } = render(<NativeFileControls mode="local" roomId={null} canImport />);

    await chooseFile(container, nativeDocument);

    expect(await screen.findByRole('heading', { name: /confirm import/i })).toBeInTheDocument();
    expect(useElementsStore.getState().elements).toEqual([existingElement]);

    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => {
      expect(useElementsStore.getState().elements).toEqual([importedElement]);
    });
    expect(useCameraStore.getState().camera).toEqual({ x: 30, y: 40, zoom: 2 });
    expect(localStorage.getItem('VDT_WHITEBOARD_SCENE')).toContain('imported');
    expect(importNativeFileToRoom).not.toHaveBeenCalled();
  });

  it('validates invalid files without changing the board', async () => {
    // @covers AC-4
    const { container } = render(<NativeFileControls mode="local" roomId={null} canImport />);

    await chooseRawFile(container, JSON.stringify({ schemaVersion: 999 }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Native file kind is not supported.',
    );
    expect(useElementsStore.getState().elements).toEqual([existingElement]);
  });

  it('confirms before merging a native file into a saved document', async () => {
    // @covers AC-1
    // @covers AC-3
    // @covers AC-5
    const nativeDocument = makeNativeDocument('saved');
    const { container } = render(<NativeFileControls mode="saved" roomId="room-1" canImport />);

    await chooseFile(container, nativeDocument);
    await screen.findByRole('heading', { name: /confirm import/i });
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => {
      expect(importNativeFileToRoom).toHaveBeenCalledWith('room-1', nativeDocument, 'merge');
    });
    expect(useElementsStore.getState().elements).toEqual([existingElement, importedElement]);
    expect(useCameraStore.getState().camera).toEqual({ x: 30, y: 40, zoom: 2 });
  });

  it('shows saved import permission errors from the server', async () => {
    // @covers AC-3
    vi.mocked(importNativeFileToRoom).mockRejectedValueOnce(
      new Error('Editor or owner access is required to import into this document.'),
    );
    const { container } = render(<NativeFileControls mode="saved" roomId="room-1" canImport />);

    await chooseFile(container, makeNativeDocument('saved'));
    await screen.findByRole('heading', { name: /confirm import/i });
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Editor or owner access is required to import into this document.',
    );
  });
});

async function chooseFile(container: HTMLElement, document: NativeFileDocument): Promise<void> {
  await chooseRawFile(container, serializeNativeFile(document));
}

async function chooseRawFile(container: HTMLElement, text: string): Promise<void> {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('File input missing.');
  }
  const file = new File([text], 'board.vdt.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => text });
  fireEvent.change(input, { target: { files: [file] } });
}

function makeNativeDocument(source: 'local' | 'saved'): NativeFileDocument {
  return buildNativeFileDocument({
    elements: [importedElement],
    camera: { x: 30, y: 40, zoom: 2 },
    room: {
      id: source === 'saved' ? 'room-1' : null,
      name: 'Imported Board',
      source,
      exportedAt: '2026-07-01T00:00:00.000Z',
    },
  });
}

function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'element-1',
    type: 'rectangle',
    x: 10,
    y: 20,
    width: 100,
    height: 80,
    angle: 0,
    zIndex: 1,
    props: {
      strokeColor: '#000000',
      fillColor: '#ffffff',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
    },
    version: 1,
    versionNonce: 123,
    updatedAt: 1700000000000,
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'user-1',
    ...overrides,
  };
}
