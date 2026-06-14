import { create } from 'zustand';
import type { Camera, Point } from '../types/shared';
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

  setCamera: (camera) => set({ camera }),

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

      // Adjust pan so the pivot point stays fixed in screen space
      const { camera } = state;
      const newX = pivot.x / clampedZoom - pivot.x / camera.zoom + camera.x;
      const newY = pivot.y / clampedZoom - pivot.y / camera.zoom + camera.y;
      return { camera: { x: newX, y: newY, zoom: clampedZoom } };
    }),

  resetCamera: () => set({ camera: DEFAULT_CAMERA }),
}));
