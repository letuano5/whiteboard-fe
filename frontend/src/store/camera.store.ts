import { create } from 'zustand';
import type { Camera } from '../types/shared';
import type { Point } from '../types/geometry';
import { MAX_ZOOM, MIN_ZOOM } from '../utils/camera';

interface CameraState {
  camera: Camera;
}

interface CameraActions {
  setCamera: (camera: Camera) => void;
  panBy: (dx: number, dy: number) => void;
  zoomTo: (zoom: number, pivot?: Point) => void;
  resetCamera: () => void;
}

const DEFAULT_CAMERA: Camera = { x: 0, y: 0, zoom: 1 };

export const useCameraStore = create<CameraState & CameraActions>()((set) => ({
  camera: DEFAULT_CAMERA,

  // Central guard against corrupted/untrusted camera data (localStorage, socket echo,
  // native file import): non-finite fields fall back to the current camera, and zoom is
  // always clamped to [MIN_ZOOM, MAX_ZOOM] — otherwise a bad zoom (0, negative, NaN)
  // propagates into screenToWorld and blanks the whole canvas.
  setCamera: (camera) =>
    set((state) => ({
      camera: {
        x: Number.isFinite(camera.x) ? camera.x : state.camera.x,
        y: Number.isFinite(camera.y) ? camera.y : state.camera.y,
        zoom: Number.isFinite(camera.zoom)
          ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom))
          : state.camera.zoom,
      },
    })),

  panBy: (dx, dy) =>
    set((state) => ({
      camera: {
        ...state.camera,
        x: state.camera.x + dx,
        y: state.camera.y + dy,
      },
    })),

  zoomTo: (zoom, pivot) =>
    set((state) => {
      const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
      if (!pivot) return { camera: { ...state.camera, zoom: clampedZoom } };

      // Keep the world point under the pivot screen-coord fixed after zoom.
      // Derived from: pivot.x/newZoom + newX == pivot.x/oldZoom + oldX
      const { camera } = state;
      const newX = pivot.x / camera.zoom - pivot.x / clampedZoom + camera.x;
      const newY = pivot.y / camera.zoom - pivot.y / clampedZoom + camera.y;
      return { camera: { x: newX, y: newY, zoom: clampedZoom } };
    }),

  resetCamera: () => set({ camera: DEFAULT_CAMERA }),
}));
