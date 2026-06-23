import type { Element } from '../../types/shared';
import type { ShapeUtil } from './types';
import { strokeDashArray } from './utils';

export const ellipseShapeUtil: ShapeUtil = {
  type: 'ellipse',

  render(element) {
    const { x, y, width, height, angle, props } = element;
    const cx = x + width / 2;
    const cy = y + height / 2;
    return (
      <ellipse
        cx={cx}
        cy={cy}
        rx={width / 2}
        ry={height / 2}
        fill={props.fillColor}
        stroke={props.strokeColor}
        strokeWidth={props.strokeWidth}
        strokeDasharray={strokeDashArray(props.strokeStyle)}
        opacity={props.opacity}
        transform={angle !== 0 ? `rotate(${(angle * 180) / Math.PI} ${cx} ${cy})` : undefined}
      />
    );
  },

  hitTest(element, x, y) {
    return x >= element.x && x <= element.x + element.width && y >= element.y && y <= element.y + element.height;
  },

  getBounds({ x, y, width, height }) {
    return { x, y, width, height };
  },

  resize(_element, _handle, _dx, _dy): Partial<Element> {
    return {};
  },
};
