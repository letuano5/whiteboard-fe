import type { Camera, Element } from '../../types/shared';
import type { HandleId, ResizeHandleId } from '../../types/interaction';
import { getShapeUtil } from '../shapes';
import { useInteractionStore } from '../../store/interaction.store';

const ROTATE_HANDLE_OFFSET = 24;

interface SelectionOverlayProps {
  element: Element;
  onHandlePointerDown?: (handle: HandleId, e: React.PointerEvent<SVGCircleElement>) => void;
}

function SelectionOverlay({ element, onHandlePointerDown }: SelectionOverlayProps) {
  const { x, y, width: w, height: h, angle } = element;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const handles: [ResizeHandleId, number, number][] = [
    ['nw', x, y],
    ['ne', x + w, y],
    ['sw', x, y + h],
    ['se', x + w, y + h],
    ['n', x + w / 2, y],
    ['s', x + w / 2, y + h],
    ['e', x + w, y + h / 2],
    ['w', x, y + h / 2],
  ];
  const rotateTransform =
    angle !== 0 ? `rotate(${(angle * 180) / Math.PI} ${cx} ${cy})` : undefined;
  return (
    <g transform={rotateTransform}>
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
          data-handle={id}
          cx={hx}
          cy={hy}
          r={4}
          fill="white"
          stroke="#3b82f6"
          strokeWidth={1.5}
          style={{ cursor: 'pointer' }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const svgEl = e.currentTarget.closest('svg') as SVGSVGElement | null;
            svgEl?.setPointerCapture?.(e.pointerId);
            onHandlePointerDown?.(id, e);
          }}
        />
      ))}
      {/* Rotate handle */}
      <line x1={cx} y1={y} x2={cx} y2={y - ROTATE_HANDLE_OFFSET} stroke="#3b82f6" strokeWidth={1} />
      <circle
        data-handle="rotate"
        cx={cx}
        cy={y - ROTATE_HANDLE_OFFSET}
        r={5}
        fill="white"
        stroke="#3b82f6"
        strokeWidth={1.5}
        style={{ cursor: 'crosshair' }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const svgEl = e.currentTarget.closest('svg') as SVGSVGElement | null;
          svgEl?.setPointerCapture?.(e.pointerId);
          onHandlePointerDown?.('rotate', e);
        }}
      />
    </g>
  );
}

interface SvgLayerProps {
  elements: Element[];
  camera: Camera;
  draftElement?: Element | null;
  editingId?: string | null;
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerLeave?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  onHandlePointerDown?: (handle: HandleId, e: React.PointerEvent<SVGCircleElement>) => void;
}

export default function SvgLayer({
  elements,
  camera,
  draftElement,
  editingId,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onDoubleClick,
  onHandlePointerDown,
}: SvgLayerProps) {
  const selectedIds = useInteractionStore((s) => s.selectedIds);
  const laserTrail = useInteractionStore((s) => s.laserTrail);
  const laserFading = useInteractionStore((s) => s.laserFading);
  const selectedElement =
    selectedIds.length > 0
      ? elements.find((el) => el.id === selectedIds[0] && !el.isDeleted)
      : undefined;
  const overlayElement =
    selectedElement && draftElement?.id === selectedElement.id ? draftElement : selectedElement;
  const isEditingExistingElement = elements.some((el) => el.id === draftElement?.id);
  const visible = elements
    .filter((el) => !el.isDeleted && el.id !== draftElement?.id)
    .sort((a, b) => a.zIndex - b.zIndex);

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onDoubleClick={onDoubleClick}
    >
      <g transform={`scale(${camera.zoom}) translate(${-camera.x} ${-camera.y})`}>
        {visible.map((el) => {
          const util = getShapeUtil(el.type);
          if (!util) return null;
          return (
            <g key={el.id} opacity={el.id === editingId ? 0 : undefined}>
              {util.render(el)}
            </g>
          );
        })}
        {draftElement &&
          (() => {
            const util = getShapeUtil(draftElement.type);
            if (!util) return null;
            return <g opacity={isEditingExistingElement ? 1 : 0.6}>{util.render(draftElement)}</g>;
          })()}
        {overlayElement && !editingId && (
          <SelectionOverlay element={overlayElement} onHandlePointerDown={onHandlePointerDown} />
        )}
        {laserTrail.length >= 2 && (
          <polyline
            points={laserTrail.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#ef4444"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={laserFading ? 0 : 1}
            style={{
              transition: laserFading ? 'opacity 0.5s ease-out' : 'none',
              pointerEvents: 'none',
            }}
          />
        )}
      </g>
    </svg>
  );
}
