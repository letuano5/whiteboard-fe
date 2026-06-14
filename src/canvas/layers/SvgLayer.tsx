import type { Camera, Element } from '../../types/shared';
import { getShapeUtil } from '../shapes';

interface SvgLayerProps {
  elements: Element[];
  camera: Camera;
}

export default function SvgLayer({ elements, camera }: SvgLayerProps) {
  const visible = elements.filter((el) => !el.isDeleted).sort((a, b) => a.zIndex - b.zIndex);

  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <g transform={`scale(${camera.zoom}) translate(${-camera.x} ${-camera.y})`}>
        {visible.map((el) => {
          const util = getShapeUtil(el.type);
          if (!util) return null;
          return <g key={el.id}>{util.render(el)}</g>;
        })}
      </g>
    </svg>
  );
}
