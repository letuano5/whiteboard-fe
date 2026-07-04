import { normalizeLinearBounds } from '../utils/geometry';

export type FreehandPoint = [number, number];

export const MAX_POINTS_PER_FREEHAND_STROKE = 600;
export const FREEHAND_SIMPLIFICATION_TOLERANCE = 1.5;

export function toFreehandPoint(point: { x: number; y: number }): FreehandPoint {
  return [point.x, point.y];
}

export function areSameFreehandPoint(a: FreehandPoint, b: FreehandPoint): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export function appendDistinctFreehandPoint(
  points: FreehandPoint[],
  point: FreehandPoint,
): FreehandPoint[] {
  const last = points[points.length - 1];
  if (last && areSameFreehandPoint(last, point)) return points;
  return [...points, point];
}

function squaredDistanceToSegment(
  point: FreehandPoint,
  start: FreehandPoint,
  end: FreehandPoint,
): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const len2 = dx * dx + dy * dy;

  if (len2 === 0) {
    return (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2;
  }

  const t = Math.max(
    0,
    Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / len2),
  );
  const closestX = start[0] + t * dx;
  const closestY = start[1] + t * dy;
  return (point[0] - closestX) ** 2 + (point[1] - closestY) ** 2;
}

function simplifyRange(
  points: FreehandPoint[],
  firstIndex: number,
  lastIndex: number,
  tolerance2: number,
  keep: boolean[],
): void {
  if (lastIndex <= firstIndex + 1) return;

  let maxDistance = -1;
  let maxIndex = firstIndex;

  for (let index = firstIndex + 1; index < lastIndex; index += 1) {
    const distance = squaredDistanceToSegment(points[index], points[firstIndex], points[lastIndex]);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = index;
    }
  }

  if (maxDistance <= tolerance2) return;

  keep[maxIndex] = true;
  simplifyRange(points, firstIndex, maxIndex, tolerance2, keep);
  simplifyRange(points, maxIndex, lastIndex, tolerance2, keep);
}

export function simplifyFreehandPoints(
  rawPoints: FreehandPoint[] | undefined,
  tolerance = FREEHAND_SIMPLIFICATION_TOLERANCE,
): FreehandPoint[] {
  if (!rawPoints || rawPoints.length === 0) return [];

  const points = rawPoints.reduce<FreehandPoint[]>((acc, point) => {
    const last = acc[acc.length - 1];
    if (!last || !areSameFreehandPoint(last, point)) acc.push(point);
    return acc;
  }, []);

  if (points.length <= 2) return points;

  const keep = points.map(() => false);
  keep[0] = true;
  keep[points.length - 1] = true;
  simplifyRange(points, 0, points.length - 1, tolerance * tolerance, keep);
  return points.filter((_point, index) => keep[index]);
}

export function boundsForFreehandPoints(points: FreehandPoint[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return normalizeLinearBounds(points);
}

function midpoint(a: FreehandPoint, b: FreehandPoint): FreehandPoint {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export function buildFreehandPath(
  rawPoints: FreehandPoint[] | undefined,
  tolerance = FREEHAND_SIMPLIFICATION_TOLERANCE,
): string {
  const points = simplifyFreehandPoints(rawPoints, tolerance);
  if (points.length === 0) return '';

  const [start] = points;
  if (points.length === 1) return `M ${start[0]} ${start[1]}`;
  if (points.length === 2) return `M ${start[0]} ${start[1]} L ${points[1][0]} ${points[1][1]}`;

  const commands = [`M ${start[0]} ${start[1]}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const [controlX, controlY] = points[index];
    const [midX, midY] = midpoint(points[index], points[index + 1]);
    commands.push(`Q ${controlX} ${controlY} ${midX} ${midY}`);
  }

  const last = points[points.length - 1];
  commands.push(`L ${last[0]} ${last[1]}`);
  return commands.join(' ');
}

export function splitFreehandStrokeAtCap(
  points: FreehandPoint[],
  maxPoints = MAX_POINTS_PER_FREEHAND_STROKE,
): { committed: FreehandPoint[] | null; active: FreehandPoint[] } {
  if (points.length <= maxPoints) {
    return { committed: null, active: points };
  }

  const committed = points.slice(0, maxPoints);
  const overflow = points.slice(maxPoints);
  const bridge = committed[committed.length - 1];
  return { committed, active: [bridge, ...overflow] };
}
