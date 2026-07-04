import { useCameraStore } from '../store/camera.store';
import type { Camera } from '../types/shared';

const CAMERA_KEY_PREFIX = 'VDT_CAMERA_';
const DEBOUNCE_MS = 300;

function storageKey(roomId: string): string {
  return `${CAMERA_KEY_PREFIX}${roomId}`;
}

export function loadCamera(roomId: string): void {
  try {
    const raw = localStorage.getItem(storageKey(roomId));
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      Number.isFinite((parsed as Record<string, unknown>).x) &&
      Number.isFinite((parsed as Record<string, unknown>).y) &&
      Number.isFinite((parsed as Record<string, unknown>).zoom)
    ) {
      useCameraStore.getState().setCamera(parsed as Camera);
    }
  } catch {
    // corrupted — ignore, keep default camera
  }
}

export function saveCamera(roomId: string, camera: Camera): void {
  try {
    localStorage.setItem(storageKey(roomId), JSON.stringify(camera));
  } catch {
    // QuotaExceededError — fail silently
  }
}

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
let _unsub: (() => void) | null = null;

export function startCameraPersistence(roomId: string): () => void {
  _unsub = useCameraStore.subscribe((state, prevState) => {
    if (state.camera === prevState.camera) return;
    if (_debounceTimer !== null) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      _debounceTimer = null;
      saveCamera(roomId, useCameraStore.getState().camera);
    }, DEBOUNCE_MS);
  });

  return () => {
    _unsub?.();
    _unsub = null;
    if (_debounceTimer !== null) {
      clearTimeout(_debounceTimer);
      _debounceTimer = null;
    }
  };
}
