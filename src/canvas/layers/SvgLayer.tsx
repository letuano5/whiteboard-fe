import type { Camera, Element } from '../../types/shared';
import type { HandleId } from '../../types/interaction';
import { getShapeUtil } from '../shapes';
import { useInteractionStore } from '../../store/interaction.store';

interface SelectionOverlayProps {
  element: Element;
  onHandlePointerDown?: (handle: HandleId, e: React.PointerEvent<SVGCircleElement>) => void;
}

function SelectionOverlay({ element, onHandlePointerDown }: SelectionOverlayProps) {
  const { x, y, width: w, height: h } = element;
  const handles: [HandleId, number, number][] = [
    ['nw', x, y],
    ['ne', x + w, y],
    ['sw', x, y + h],
    ['se', x + w, y + h],
    ['n', x + w / 2, y],
    ['s', x + w / 2, y + h],
    ['e', x + w, y + h / 2],
    ['w', x, y + h / 2],
  ];
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={1.5}
        strokeDasharray="4 2"
      />
      {handles.map(([id, hx, hy]) => (
        <circle
          key={id}
          cx={hx}
          cy={hy}
          r={4}
          fill="white"
          stroke="#3b82f6"
          strokeWidth={1.5}
          style={{ cursor: 'pointer' }}
          onPointerDown={(e) => {
            e.stopPropagation();
            const svgEl = e.currentTarget.closest('svg') as SVGSVGElement | null;
            svgEl?.setPointerCapture(e.pointerId);
            onHandlePointerDown?.(id, e);
          }}
        />
      ))}
    </g>
  );
}

interface SvgLayerProps {
  elements: Element[];
  camera: Camera;
  draftElement?: Element | null;
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerLeave?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onHandlePointerDown?: (handle: HandleId, e: React.PointerEvent<SVGCircleElement>) => void;
}

export default function SvgLayer({
  elements,
  camera,
  draftElement,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onHandlePointerDown,
}: SvgLayerProps) {
  const selectedIds = useInteractionStore((s) => s.selectedIds);
  const selectedElement =
    selectedIds.length > 0 ? elements.find((el) => el.id === selectedIds[0] && !el.isDeleted) : undefined;
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
        {selectedElement && (
          <SelectionOverlay element={selectedElement} onHandlePointerDown={onHandlePointerDown} />
        )}
      </g>
    </svg>
  );
}
