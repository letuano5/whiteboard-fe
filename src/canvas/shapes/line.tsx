import type { Element } from '../../types/shared';
import type { ShapeUtil } from './types';
import { strokeDashArray } from './utils';

export const lineShapeUtil: ShapeUtil = {
  type: 'line',

  render(element) {
    const { x, y, width, height, props } = element;
    const dasharray = strokeDashArray(props.strokeStyle);

    if (props.points && props.points.length >= 2) {
      const pointsStr = props.points.map(([px, py]) => `${px},${py}`).join(' ');
      return (
        <polyline
          points={pointsStr}
          fill="none"
          stroke={props.strokeColor}
          strokeWidth={props.strokeWidth}
          strokeDasharray={dasharray}
          opacity={props.opacity}
        />
      );
    }

    return (
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
    );
  },

  hitTest(_element, _x, _y) {
    return false;
  },

  getBounds({ x, y, width, height }) {
    return { x, y, width, height };
  },

  resize(_element, _handle, _dx, _dy): Partial<Element> {
    return {};
  },
};
