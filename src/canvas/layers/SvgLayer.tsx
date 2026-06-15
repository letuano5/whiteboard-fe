import type { Camera, Element } from '../../types/shared';
import { getShapeUtil } from '../shapes';

interface SvgLayerProps {
  elements: Element[];
  camera: Camera;
  draftElement?: Element | null;
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerLeave?: (e: React.PointerEvent<SVGSVGElement>) => void;
}

export default function SvgLayer({
  elements,
  camera,
  draftElement,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
}: SvgLayerProps) {
  const visible = elements.filter((el) => !el.isDeleted).sort((a, b) => a.zIndex - b.zIndex);

  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      <g transform={`scale(${camera.zoom}) translate(${-camera.x} ${-camera.y})`}>
        {visible.map((el) => {
          const util = getShapeUtil(el.type);
          if (!util) return null;
          return <g key={el.id}>{util.render(el)}</g>;
        })}
        {draftElement && (() => {
          const util = getShapeUtil(draftElement.type);
          if (!util) return null;
          return <g opacity={0.6}>{util.render(draftElement)}</g>;
        })()}
      </g>
    </svg>
  );
}
