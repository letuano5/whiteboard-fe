import type { Camera } from '../types/shared';
import type { Element } from '../types/shared';
import type { Point } from '../types/geometry';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
// AC-8: zoom factor per raw wheel delta unit must be ≤ 0.01
export const ZOOM_SENSITIVITY = 0.005;
// ~7.5% padding each side when fitting content to viewport
export const FIT_PADDING = 0.85;

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

export interface ContentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Returns the axis-aligned bounding box of all non-deleted elements, or null if none exist. */
export function getContentBounds(elements: Element[]): ContentBounds | null {
  const active = elements.filter((el) => !el.isDeleted);
  if (active.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const el of active) {
    if (el.x < minX) minX = el.x;
    if (el.y < minY) minY = el.y;
    if (el.x + el.width > maxX) maxX = el.x + el.width;
    if (el.y + el.height > maxY) maxY = el.y + el.height;
  }
  return { minX, minY, maxX, maxY };
}

/** Returns true if any non-deleted element's bbox intersects the viewport rectangle. */
export function isAnyElementVisible(
  elements: Element[],
  camera: Camera,
  viewportW: number,
  viewportH: number,
): boolean {
  if (viewportW <= 0 || viewportH <= 0) return false;
  const worldLeft = camera.x;
  const worldTop = camera.y;
  const worldRight = camera.x + viewportW / camera.zoom;
  const worldBottom = camera.y + viewportH / camera.zoom;
  return elements.some(
    (el) =>
      !el.isDeleted &&
      el.x < worldRight &&
      el.x + el.width > worldLeft &&
      el.y < worldBottom &&
      el.y + el.height > worldTop,
  );
}

/** Returns a Camera that fits all non-deleted elements in the viewport with FIT_PADDING. */
export function fitToContent(
  elements: Element[],
  _camera: Camera,
  viewportW: number,
  viewportH: number,
): Camera {
  const bounds = getContentBounds(elements);
  if (!bounds || viewportW <= 0 || viewportH <= 0) return _camera;
  const { minX, minY, maxX, maxY } = bounds;
  const contentW = maxX - minX || 1;
  const contentH = maxY - minY || 1;
  const rawZoom = Math.min((viewportW * FIT_PADDING) / contentW, (viewportH * FIT_PADDING) / contentH);
  const zoom = Math.min(Math.max(rawZoom, MIN_ZOOM), MAX_ZOOM);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return {
    x: centerX - viewportW / (2 * zoom),
    y: centerY - viewportH / (2 * zoom),
    zoom,
  };
}
