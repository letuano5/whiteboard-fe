export interface TouchPoint {
  x: number;
  y: number;
}

export interface PinchSnapshot {
  midX: number;
  midY: number;
  dist: number;
}

export function setActivePointer(
  activePointers: Map<number, TouchPoint>,
  pointerId: number,
  point: TouchPoint,
): void {
  activePointers.set(pointerId, point);
}

export function getPinchPoints(
  activePointers: Map<number, TouchPoint>,
): [TouchPoint, TouchPoint] | null {
  const points = [...activePointers.values()];
  if (points.length < 2) return null;
  return [points[0], points[1]];
}

export function midpointAndDistance(a: TouchPoint, b: TouchPoint): PinchSnapshot {
  return {
    midX: (a.x + b.x) / 2,
    midY: (a.y + b.y) / 2,
    dist: Math.hypot(a.x - b.x, a.y - b.y),
  };
}

export function getPinchSnapshot(activePointers: Map<number, TouchPoint>): PinchSnapshot | null {
  const points = getPinchPoints(activePointers);
  if (!points) return null;
  return midpointAndDistance(points[0], points[1]);
}
