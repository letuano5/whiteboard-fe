import type { Camera, Point } from '../types/shared';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;

export function screenToWorld(screenX: number, screenY: number, camera: Camera): Point {
  return {
    x: screenX / camera.zoom + camera.x,
    y: screenY / camera.zoom + camera.y,
  };
}

export function worldToScreen(worldX: number, worldY: number, camera: Camera): Point {
  return {
    x: (worldX - camera.x) * camera.zoom,
    y: (worldY - camera.y) * camera.zoom,
  };
}
