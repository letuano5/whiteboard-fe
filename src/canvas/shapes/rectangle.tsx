import type { Element } from '../../types/shared';
import type { ShapeUtil } from './types';
import { strokeDashArray } from './utils';

export const rectangleShapeUtil: ShapeUtil = {
  type: 'rectangle',

  render(element) {
    const { x, y, width, height, angle, props } = element;
    const cx = x + width / 2;
    const cy = y + height / 2;
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={props.fillColor}
        stroke={props.strokeColor}
        strokeWidth={props.strokeWidth}
        strokeDasharray={strokeDashArray(props.strokeStyle)}
        opacity={props.opacity}
        transform={angle !== 0 ? `rotate(${(angle * 180) / Math.PI} ${cx} ${cy})` : undefined}
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
