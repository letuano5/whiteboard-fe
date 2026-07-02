import type { Element } from '../../types/shared';
import type { ShapeUtil } from './types';
import { normalizeLinearBounds } from '../../utils/geometry';

const HIT_THRESHOLD = 8;

function getInkPath(points: [number, number][] | undefined): string {
  if (!points || points.length === 0) return '';

  const [[startX, startY], ...rest] = points;
  return [`M ${startX} ${startY}`, ...rest.map(([x, y]) => `L ${x} ${y}`)].join(' ');
}

function distanceToSegment(
  x: number,
  y: number,
  [x1, y1]: [number, number],
  [x2, y2]: [number, number],
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  return Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);
}

function hitTestInkPoints(points: [number, number][] | undefined, x: number, y: number): boolean {
  if (!points || points.length === 0) return false;
  if (points.length === 1) {
    const [[px, py]] = points;
    return Math.sqrt((x - px) ** 2 + (y - py) ** 2) <= HIT_THRESHOLD;
  }

  return points.some((point, index) => {
    const next = points[index + 1];
    return next ? distanceToSegment(x, y, point, next) <= HIT_THRESHOLD : false;
  });
}

function createInkShapeUtil(type: 'freehand' | 'highlighter'): ShapeUtil {
  return {
    type,

    render(element) {
      const { props } = element;
      const d = getInkPath(props.points);

      return (
        <path
          d={d}
          fill="none"
          stroke={props.strokeColor}
          strokeWidth={props.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={props.opacity}
        />
      );
    },

    hitTest(element, x, y) {
      return hitTestInkPoints(element.props.points, x, y);
    },

    getBounds(element) {
      return normalizeLinearBounds(element.props.points ?? []);
    },

    resize(_element, _handle, _dx, _dy): Partial<Element> {
      return {};
    },
  };
}

export const freehandShapeUtil = createInkShapeUtil('freehand');
export const highlighterShapeUtil = createInkShapeUtil('highlighter');
