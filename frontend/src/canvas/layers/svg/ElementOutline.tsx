import type { Element } from '../../../types/shared';
import { getShapeUtil } from '../../shapes';

interface ElementOutlineProps {
  element: Element;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}

export default function ElementOutline({
  element,
  stroke,
  strokeWidth,
  strokeDasharray,
}: ElementOutlineProps) {
  const util = getShapeUtil(element.type);
  const bounds = util?.getBounds(element) ?? {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const rotateTransform =
    element.angle !== 0 ? `rotate(${(element.angle * 180) / Math.PI} ${cx} ${cy})` : undefined;

  return (
    <rect
      x={bounds.x}
      y={bounds.y}
      width={bounds.width}
      height={bounds.height}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      transform={rotateTransform}
      style={{ pointerEvents: 'none' }}
    />
  );
}
