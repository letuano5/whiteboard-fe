import type { Element } from '../../types/shared';
import type { ShapeUtil } from './types';
import { getBoundTextLines } from '../text/text-wrap';

export const textShapeUtil: ShapeUtil = {
  type: 'text',

  render(element, context) {
    const { x, y, angle, props } = element;
    const cx = x + element.width / 2;
    const cy = y + element.height / 2;
    const fontSize = props.fontSize ?? 16;
    const lineHeight = fontSize * 1.2;
    const textAnchor =
      props.textAlign === 'center' ? 'middle' : props.textAlign === 'right' ? 'end' : 'start';
    const textX =
      props.textAlign === 'center'
        ? x + element.width / 2
        : props.textAlign === 'right'
          ? x + element.width
          : x;
    const hasBorder =
      props.fillColor !== 'transparent' && props.fillColor !== 'none' && props.strokeWidth > 0;
    const boundLines = context ? getBoundTextLines(element, context.elements) : null;
    const lines = boundLines?.lines ?? (props.text ?? '').split('\n');
    const renderedTextX = boundLines?.textX ?? textX;
    const renderedY = boundLines?.firstLineY ?? y + fontSize;
    const renderedLineHeight = boundLines?.lineHeight ?? lineHeight;
    const renderedTextAnchor = boundLines ? 'middle' : textAnchor;
    return (
      <text
        x={renderedTextX}
        y={renderedY}
        fontSize={fontSize}
        fontFamily={props.fontFamily ?? 'sans-serif'}
        textAnchor={renderedTextAnchor}
        fill={props.strokeColor}
        stroke={hasBorder ? props.fillColor : undefined}
        strokeWidth={hasBorder ? props.strokeWidth : undefined}
        paintOrder={hasBorder ? 'stroke fill' : undefined}
        opacity={props.opacity}
        transform={angle !== 0 ? `rotate(${(angle * 180) / Math.PI} ${cx} ${cy})` : undefined}
        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={renderedTextX} dy={i === 0 ? 0 : renderedLineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    );
  },

  hitTest(element, x, y) {
    return (
      x >= element.x &&
      x <= element.x + element.width &&
      y >= element.y &&
      y <= element.y + element.height
    );
  },

  getBounds({ x, y, width, height }) {
    return { x, y, width, height };
  },

  resize(_element, _handle, _dx, _dy): Partial<Element> {
    return {};
  },
};
