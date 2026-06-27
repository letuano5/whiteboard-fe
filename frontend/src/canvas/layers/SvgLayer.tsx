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
  const marquee = useInteractionStore((s) => s.marquee);
  const draftElements = useInteractionStore((s) => s.draftElements);

  const selectedElement =
    selectedIds.length === 1
      ? elements.find((el) => el.id === selectedIds[0] && !el.isDeleted)
      : undefined;
  const overlayElement =
    selectedElement && draftElement?.id === selectedElement.id ? draftElement : selectedElement;
  const isEditingExistingElement = elements.some((el) => el.id === draftElement?.id);

  // IDs currently shown as draftElements (hide their committed versions to avoid doubling)
  const draftElementIds = new Set(draftElements.map((el) => el.id));

  const visible = elements
    .filter((el) => !el.isDeleted && el.id !== draftElement?.id && !draftElementIds.has(el.id))
    .sort((a, b) => a.zIndex - b.zIndex);

  // Multi-select union bounding box
  let multiSelectRect: { x: number; y: number; w: number; h: number } | null = null;
  if (selectedIds.length > 1) {
    const selected = elements.filter((el) => selectedIds.includes(el.id) && !el.isDeleted);
    if (selected.length > 1) {
      const xs = selected.flatMap((el) => [el.x, el.x + el.width]);
      const ys = selected.flatMap((el) => [el.y, el.y + el.height]);
      multiSelectRect = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys),
      };
    }
  }

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
        {/* Multi-drag: render draft positions */}
        {draftElements.map((draftEl) => {
          const util = getShapeUtil(draftEl.type);
          if (!util) return null;
          return (
            <g key={draftEl.id} opacity={0.6} style={{ pointerEvents: 'none' }}>
              {util.render(draftEl)}
            </g>
          );
        })}
        {/* Single selection overlay with handles */}
        {overlayElement && !editingId && draftElements.length === 0 && (
          <SelectionOverlay element={overlayElement} onHandlePointerDown={onHandlePointerDown} />
        )}
        {/* Multi-select bounding box (no handles) */}
        {multiSelectRect && draftElements.length === 0 && (
          <rect
            x={multiSelectRect.x}
            y={multiSelectRect.y}
            width={multiSelectRect.w}
            height={multiSelectRect.h}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            style={{ pointerEvents: 'none' }}
          />
        )}
        {/* Marquee rubber-band rect */}
        {marquee && (
          <rect
            x={marquee.x}
            y={marquee.y}
            width={marquee.width}
            height={marquee.height}
            fill="rgba(59, 130, 246, 0.08)"
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="4 2"
            style={{ pointerEvents: 'none' }}
          />
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
