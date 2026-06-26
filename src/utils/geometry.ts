import type { Point } from '../types/geometry';

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
