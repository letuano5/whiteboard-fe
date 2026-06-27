import type { Element } from '../../types/shared';
import type { ShapeUtil } from './types';
import { strokeDashArray } from './utils';

const ARROW_HEAD_LEN = 12;
const ARROW_HEAD_WIDTH = 8;

function computeArrowHead(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { shaft: [number, number]; poly: string } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) {
    return { shaft: [x2, y2], poly: `${x2},${y2}` };
  }
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const baseX = x2 - ARROW_HEAD_LEN * ux;
  const baseY = y2 - ARROW_HEAD_LEN * uy;
  const b1x = baseX + (ARROW_HEAD_WIDTH / 2) * px;
  const b1y = baseY + (ARROW_HEAD_WIDTH / 2) * py;
  const b2x = baseX - (ARROW_HEAD_WIDTH / 2) * px;
  const b2y = baseY - (ARROW_HEAD_WIDTH / 2) * py;
  return {
    shaft: [baseX, baseY],
    poly: `${x2},${y2} ${b1x},${b1y} ${b2x},${b2y}`,
  };
}

export const arrowShapeUtil: ShapeUtil = {
  type: 'arrow',

  render(element) {
    const { x, y, width, height, angle, props } = element;
    const dasharray = strokeDashArray(props.strokeStyle);
    const cx = x + width / 2;
    const cy = y + height / 2;
    const transform = angle !== 0 ? `rotate(${(angle * 180) / Math.PI} ${cx} ${cy})` : undefined;

    let x1: number, y1: number, x2: number, y2: number;
    if (props.points && props.points.length >= 2) {
      [[x1, y1], [x2, y2]] = props.points;
    } else {
      x1 = x;
      y1 = y;
      x2 = x + width;
      y2 = y + height;
    }

    const { shaft, poly } = computeArrowHead(x1, y1, x2, y2);

    return (
      <g transform={transform} opacity={props.opacity}>
        <line
          x1={x1}
          y1={y1}
          x2={shaft[0]}
          y2={shaft[1]}
          stroke={props.strokeColor}
          strokeWidth={props.strokeWidth}
          strokeDasharray={dasharray}
          strokeLinecap="round"
        />
        <polygon points={poly} fill={props.strokeColor} stroke="none" />
      </g>
    );
  },

  hitTest(element, x, y) {
    const HIT_THRESHOLD = Math.max(8, (element.props.strokeWidth ?? 2) / 2);
    let x1: number, y1: number, x2: number, y2: number;
    if (element.props.points && element.props.points.length >= 2) {
      [[x1, y1], [x2, y2]] = element.props.points;
    } else {
      x1 = element.x;
      y1 = element.y;
      x2 = element.x + element.width;
      y2 = element.y + element.height;
    }
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
    const dist = Math.sqrt((x - (x1 + t * dx)) ** 2 + (y - (y1 + t * dy)) ** 2);
    return dist <= HIT_THRESHOLD;
  },

  getBounds({ x, y, width, height }) {
    return { x, y, width, height };
  },

  resize(): Partial<Element> {
    return {};
  },
};
