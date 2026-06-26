import type { Element } from '../../types/shared';
import type { ShapeUtil } from './types';
import { strokeDashArray } from './utils';

export const lineShapeUtil: ShapeUtil = {
  type: 'line',

  render(element) {
    const { x, y, width, height, angle, props } = element;
    const dasharray = strokeDashArray(props.strokeStyle);
    const cx = x + width / 2;
    const cy = y + height / 2;
    const transform = angle !== 0 ? `rotate(${(angle * 180) / Math.PI} ${cx} ${cy})` : undefined;

    if (props.points && props.points.length >= 2) {
      const pointsStr = props.points.map(([px, py]) => `${px},${py}`).join(' ');
      return (
        <g transform={transform}>
          <polyline
            points={pointsStr}
            fill="none"
            stroke={props.strokeColor}
            strokeWidth={props.strokeWidth}
            strokeDasharray={dasharray}
            opacity={props.opacity}
          />
        </g>
      );
    }

    return (
      <g transform={transform}>
        <line
          x1={x}
          y1={y}
          x2={x + width}
          y2={y + height}
          stroke={props.strokeColor}
          strokeWidth={props.strokeWidth}
          strokeDasharray={dasharray}
          opacity={props.opacity}
        />
      </g>
    );
  },

  hitTest(element, x, y) {
    const HIT_THRESHOLD = 8;
    if (element.props.points && element.props.points.length >= 2) {
      const [x1, y1] = element.props.points[0];
      const [x2, y2] = element.props.points[1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
      const dist = Math.sqrt((x - (x1 + t * dx)) ** 2 + (y - (y1 + t * dy)) ** 2);
      return dist <= HIT_THRESHOLD;
    }
    return (
      x >= element.x - HIT_THRESHOLD &&
      x <= element.x + element.width + HIT_THRESHOLD &&
      y >= element.y - HIT_THRESHOLD &&
      y <= element.y + element.height + HIT_THRESHOLD
    );
  },

  getBounds({ x, y, width, height }) {
    return { x, y, width, height };
  },

  resize(_element, _handle, _dx, _dy): Partial<Element> {
    return {};
  },
};
