import type { Camera, Element } from '../types/shared';
import { useElementsStore } from '../store/elements.store';
import { useCameraStore } from '../store/camera.store';
import { registerMutationHook } from '../store/mutation-pipeline';

export const STORAGE_KEY = 'VDT_WHITEBOARD_SCENE';
const DEBOUNCE_MS = 300;

interface PersistedScene {
  elements: Element[];
  camera: Camera;
}

function isValidScene(value: unknown): value is PersistedScene {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.elements)) return false;
  if (typeof v.camera !== 'object' || v.camera === null) return false;
  const cam = v.camera as Record<string, unknown>;
  return typeof cam.x === 'number' && typeof cam.y === 'number' && typeof cam.zoom === 'number';
}

function readScene(): PersistedScene | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidScene(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeScene(scene: PersistedScene): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
  } catch {
    // QuotaExceededError or other storage errors — fail silently
  }
}

export function writeLocalScene(scene: PersistedScene): void {
  writeScene(scene);
}

export function initLocalStoragePersistence(): void {
  const scene = readScene();
  if (!scene) return;
  useElementsStore.getState().setElements(scene.elements);
  useCameraStore.getState().setCamera(scene.camera);
}

export function startLocalStoragePersistence(): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function flushWrite(): void {
    writeScene({
      elements: useElementsStore.getState().elements,
      camera: useCameraStore.getState().camera,
    });
  }

  function scheduleWrite(): void {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flushWrite, DEBOUNCE_MS);
  }

  const unregisterHook = registerMutationHook(() => scheduleWrite());

  const unsubCamera = useCameraStore.subscribe((state, prevState) => {
    if (state.camera !== prevState.camera) scheduleWrite();
  });

  return () => {
    unregisterHook();
    unsubCamera();
    if (debounceTimer !== null) clearTimeout(debounceTimer);
  };
}
