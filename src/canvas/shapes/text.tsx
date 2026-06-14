import type { Element } from '../../types/shared';
import type { ShapeUtil } from './types';

export const textShapeUtil: ShapeUtil = {
  type: 'text',

  render(element) {
    const { x, y, angle, props } = element;
    const cx = x + element.width / 2;
    const cy = y + element.height / 2;
    return (
      <text
        x={x}
        y={y + (props.fontSize ?? 16)}
        fontSize={props.fontSize ?? 16}
        fontFamily={props.fontFamily ?? 'sans-serif'}
        textAnchor={props.textAlign === 'center' ? 'middle' : props.textAlign === 'right' ? 'end' : 'start'}
        fill={props.strokeColor}
        opacity={props.opacity}
        transform={angle !== 0 ? `rotate(${(angle * 180) / Math.PI} ${cx} ${cy})` : undefined}
      >
        {props.text ?? ''}
      </text>
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
