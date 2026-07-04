import type { Element } from '../../types/shared';
import { rotatePoint } from '../../utils/geometry';

/** Snap threshold in world coordinates (view-independent). */
export const ARROW_SNAP_THRESHOLD = 20;

export type PointKey = 'center' | 'top' | 'right' | 'bottom' | 'left';

export interface AttachmentPoint {
  key: PointKey;
  x: number;
  y: number;
}

/** Returns the five canonical attachment points for a non-arrow element, rotated when angle !== 0. */
export function getAttachmentPoints(el: Element): AttachmentPoint[] {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const points: AttachmentPoint[] = [
    { key: 'center', x: cx, y: cy },
    { key: 'top', x: cx, y: el.y },
    { key: 'right', x: el.x + el.width, y: cy },
    { key: 'bottom', x: cx, y: el.y + el.height },
    { key: 'left', x: el.x, y: cy },
  ];
  if (el.angle === 0) return points;
  const center = { x: cx, y: cy };
  return points.map((ap) => {
    if (ap.key === 'center') return ap;
    const rotated = rotatePoint({ x: ap.x, y: ap.y }, center, el.angle);
    return { ...ap, x: rotated.x, y: rotated.y };
  });
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export interface SnapResult {
  elementId: string;
  pointKey: PointKey;
  x: number;
  y: number;
}

export function pointKeyToAnchorRatio(pointKey: PointKey): { x: number; y: number } {
  switch (pointKey) {
    case 'center':
      return { x: 0.5, y: 0.5 };
    case 'top':
      return { x: 0.5, y: 0 };
    case 'right':
      return { x: 1, y: 0.5 };
    case 'bottom':
      return { x: 0.5, y: 1 };
    case 'left':
      return { x: 0, y: 0.5 };
  }
}

/**
 * Finds the nearest attachment point among all non-arrow, non-deleted elements
 * (excluding `excludeId`) within ARROW_SNAP_THRESHOLD.
 *
 * Tie-breaking: when two shapes are equidistant the shape with the higher
 * zIndex wins (per plan spec).
 */
export function findNearestSnap(
  pt: { x: number; y: number },
  elements: Element[],
  excludeId: string,
): SnapResult | null {
  let bestDist = ARROW_SNAP_THRESHOLD;
  let best: SnapResult | null = null;
  let bestZIndex = -Infinity;

  for (const el of elements) {
    if (el.isDeleted) continue;
    if (el.id === excludeId) continue;
    if (el.type === 'arrow' || el.type === 'line') continue;

    for (const ap of getAttachmentPoints(el)) {
      const d = dist(pt.x, pt.y, ap.x, ap.y);
      if (d < bestDist || (d === bestDist && el.zIndex > bestZIndex)) {
        bestDist = d;
        bestZIndex = el.zIndex;
        best = { elementId: el.id, pointKey: ap.key, x: ap.x, y: ap.y };
      }
    }
  }

  return best;
}

/** Parses legacy "elementId:pointKey" bindings and P5 object bindings. */
export function parseBinding(
  b: Element['props']['startBinding'],
): { elementId: string; pointKey: PointKey } | null {
  if (!b) return null;
  if (typeof b === 'object') {
    return { elementId: b.elementId, pointKey: pointKeyFromAnchorRatio(b.anchorRatio) };
  }
  const idx = b.lastIndexOf(':');
  if (idx === -1) return null;
  const elementId = b.slice(0, idx);
  const pointKey = b.slice(idx + 1) as PointKey;
  if (!elementId || !['center', 'top', 'right', 'bottom', 'left'].includes(pointKey)) return null;
  return { elementId, pointKey };
}

function pointKeyFromAnchorRatio(anchorRatio: { x: number; y: number }): PointKey {
  const candidates: Array<{ key: PointKey; x: number; y: number }> = [
    { key: 'center', x: 0.5, y: 0.5 },
    { key: 'top', x: 0.5, y: 0 },
    { key: 'right', x: 1, y: 0.5 },
    { key: 'bottom', x: 0.5, y: 1 },
    { key: 'left', x: 0, y: 0.5 },
  ];
  let best = candidates[0];
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const dx = candidate.x - anchorRatio.x;
    const dy = candidate.y - anchorRatio.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best.key;
}

/** Computes the world position of an attachment point on the target element, accounting for rotation. */
export function computeBindingPoint(target: Element, pointKey: PointKey): { x: number; y: number } {
  const cx = target.x + target.width / 2;
  const cy = target.y + target.height / 2;
  if (pointKey === 'center') return { x: cx, y: cy };
  const unrotated =
    pointKey === 'top'
      ? { x: cx, y: target.y }
      : pointKey === 'right'
        ? { x: target.x + target.width, y: cy }
        : pointKey === 'bottom'
          ? { x: cx, y: target.y + target.height }
          : { x: target.x, y: cy }; // 'left'
  if (target.angle === 0) return unrotated;
  return rotatePoint(unrotated, { x: cx, y: cy }, target.angle);
}
