import type { Element } from '../../types/shared';
import type { ShapeUtil } from './types';
import { strokeDashArray } from './utils';

const SIDES = 6;

function regularPolygonPoints(cx: number, cy: number, rx: number, ry: number): string {
  return Array.from({ length: SIDES }, (_, index) => {
    const angle = (index / SIDES) * 2 * Math.PI - Math.PI / 2;
    return `${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`;
  }).join(' ');
}

export const polygonShapeUtil: ShapeUtil = {
  type: 'polygon',

  render(element) {
    const { x, y, width, height, angle, props } = element;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const points = regularPolygonPoints(cx, cy, width / 2, height / 2);
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
