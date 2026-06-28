import type { Element } from '../../types/shared';

/** Snap threshold in world coordinates (view-independent). */
export const ARROW_SNAP_THRESHOLD = 20;

export type PointKey = 'center' | 'top' | 'right' | 'bottom' | 'left';

export interface AttachmentPoint {
  key: PointKey;
  x: number;
  y: number;
}

/** Returns the five canonical attachment points for a non-arrow element. */
export function getAttachmentPoints(el: Element): AttachmentPoint[] {
  return [
    { key: 'center', x: el.x + el.width / 2, y: el.y + el.height / 2 },
    { key: 'top', x: el.x + el.width / 2, y: el.y },
    { key: 'right', x: el.x + el.width, y: el.y + el.height / 2 },
    { key: 'bottom', x: el.x + el.width / 2, y: el.y + el.height },
    { key: 'left', x: el.x, y: el.y + el.height / 2 },
  ];
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

/** Parses a binding string "elementId:pointKey" into its components. Returns null for null/undefined/malformed. */
export function parseBinding(b: string | null | undefined): { elementId: string; pointKey: PointKey } | null {
  if (!b) return null;
  const idx = b.lastIndexOf(':');
  if (idx === -1) return null;
  const elementId = b.slice(0, idx);
  const pointKey = b.slice(idx + 1) as PointKey;
  if (!elementId || !['center', 'top', 'right', 'bottom', 'left'].includes(pointKey)) return null;
  return { elementId, pointKey };
}

/** Computes the world position of an attachment point on the target element. */
export function computeBindingPoint(target: Element, pointKey: PointKey): { x: number; y: number } {
  switch (pointKey) {
    case 'center':
      return { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    case 'top':
      return { x: target.x + target.width / 2, y: target.y };
    case 'right':
      return { x: target.x + target.width, y: target.y + target.height / 2 };
    case 'bottom':
      return { x: target.x + target.width / 2, y: target.y + target.height };
    case 'left':
      return { x: target.x, y: target.y + target.height / 2 };
  }
}
