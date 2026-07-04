import type { Element } from '../../types/shared';
import type { ShapeUtil } from './types';
import { strokeDashArray } from './utils';

export function trianglePoints(x: number, y: number, width: number, height: number): string {
  const cx = x + width / 2;
  return [`${cx},${y}`, `${x + width},${y + height}`, `${x},${y + height}`].join(' ');
}

export const triangleShapeUtil: ShapeUtil = {
  type: 'triangle',

  render(element) {
    const { x, y, width, height, angle, props } = element;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const points = trianglePoints(x, y, width, height);
    return (
      <polygon
        points={points}
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
