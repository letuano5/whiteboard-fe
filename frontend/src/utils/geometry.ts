import type { Point } from '../types/geometry';

/**
 * Returns the tight axis-aligned bounding box of a list of 2-D points.
 * Pure function — the input array is never mutated.
 *
 * - Empty array  → { x: 0, y: 0, width: 0, height: 0 }
 * - Single point → zero-size box at that point
 * - Two or more  → tight AABB of all points
 */
export function normalizeLinearBounds(points: [number, number][]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [px, py] of points) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Rotate point `pt` around `center` by `angle` radians (counter-clockwise). */
export function rotatePoint(pt: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = pt.x - center.x;
  const dy = pt.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

/** Un-rotate: rotate `pt` around `center` by `-angle`. */
export function unrotatePoint(pt: Point, center: Point, angle: number): Point {
  return rotatePoint(pt, center, -angle);
}
