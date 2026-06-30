import type React from 'react';
import type { Element } from '../../../types/shared';
import type { EndpointHandleId, HandleId, ResizeHandleId } from '../../../types/interaction';
import type { MultiSelectBounds } from './types';

const ROTATE_HANDLE_OFFSET = 24;

interface SelectionOverlayProps {
  element: Element;
  onHandlePointerDown?: (handle: HandleId, e: React.PointerEvent<SVGCircleElement>) => void;
}

export function SelectionOverlay({ element, onHandlePointerDown }: SelectionOverlayProps) {
  if (element.type === 'arrow' || element.type === 'line') {
    const pts = element.props.points;
    if (!pts || pts.length < 2) return <g />;

    const handles: [EndpointHandleId, number, number][] = [
      ['ep-start', pts[0][0], pts[0][1]],
      ['ep-end', pts[1][0], pts[1][1]],
    ];

    return (
      <g>
        {handles.map(([id, hx, hy]) => (
          <circle
            key={id}
            data-handle={id}
            cx={hx}
            cy={hy}
            r={5}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={1.5}
            style={{ cursor: 'crosshair' }}
            onPointerDown={(e) => handlePointerDown(id, e, onHandlePointerDown)}
          />
        ))}
      </g>
    );
  }

  const { x, y, width, height, angle } = element;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const handles: [ResizeHandleId, number, number][] = [
    ['nw', x, y],
    ['ne', x + width, y],
    ['sw', x, y + height],
    ['se', x + width, y + height],
    ['n', x + width / 2, y],
    ['s', x + width / 2, y + height],
    ['e', x + width, y + height / 2],
    ['w', x, y + height / 2],
  ];
  const rotateTransform =
    angle !== 0 ? `rotate(${(angle * 180) / Math.PI} ${cx} ${cy})` : undefined;

  return (
    <g transform={rotateTransform}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
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
          onPointerDown={(e) => handlePointerDown(id, e, onHandlePointerDown)}
        />
      ))}
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
        onPointerDown={(e) => handlePointerDown('rotate', e, onHandlePointerDown)}
      />
    </g>
  );
}

interface MultiSelectionOverlayProps {
  bounds: MultiSelectBounds;
}

export function MultiSelectionOverlay({ bounds }: MultiSelectionOverlayProps) {
  return (
    <rect
      x={bounds.x}
      y={bounds.y}
      width={bounds.width}
      height={bounds.height}
      fill="none"
      stroke="#3b82f6"
      strokeWidth={1.5}
      strokeDasharray="4 2"
      style={{ pointerEvents: 'none' }}
    />
  );
}

function handlePointerDown(
  handle: HandleId,
  e: React.PointerEvent<SVGCircleElement>,
  onHandlePointerDown?: (handle: HandleId, e: React.PointerEvent<SVGCircleElement>) => void,
) {
  e.preventDefault();
  e.stopPropagation();
  const svgEl = e.currentTarget.closest('svg') as SVGSVGElement | null;
  svgEl?.setPointerCapture?.(e.pointerId);
  onHandlePointerDown?.(handle, e);
}
