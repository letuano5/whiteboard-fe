import { DASHBOARD_PREVIEW_ELEMENT_LIMIT } from '../types/shared';
import type { Element } from '../types/shared';
import { buildFreehandPath } from '../canvas/freehand-points';
import { regularPolygonPoints } from '../canvas/shapes/polygon';
import { trianglePoints } from '../canvas/shapes/triangle';

export function DocumentPreview({ elements, title }: { elements: Element[]; title: string }) {
  const visibleElements = elements
    .filter((element) => !element.isDeleted)
    .sort((a, b) => a.zIndex - b.zIndex)
    .slice(0, DASHBOARD_PREVIEW_ELEMENT_LIMIT);
  const bounds = getBounds(visibleElements);

  return (
    <div className="aspect-[4/3] overflow-hidden rounded-md bg-[#eef1f3] p-4 shadow-inner">
      <svg
        viewBox="0 0 360 255"
        role="img"
        aria-label={`${title} preview`}
        className="h-full w-full rounded-sm bg-white shadow-[0_2px_8px_rgba(20,24,28,0.18)]"
      >
        <rect width="360" height="255" fill="#ffffff" />
        <path
          d={buildGridPath()}
          fill="none"
          stroke="#eef1f3"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {visibleElements.length && bounds ? (
          <g transform={previewTransform(bounds)}>
            {visibleElements.map((element) => (
              <PreviewElement key={element.id} element={element} />
            ))}
          </g>
        ) : (
          <g>
            <rect x="86" y="76" width="188" height="72" rx="8" fill="#f4f6f8" />
            <path
              d="M112 112h136M112 132h96"
              stroke="#c8d0d7"
              strokeWidth="8"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>
    </div>
  );
}

function PreviewElement({ element }: { element: Element }) {
  const stroke = element.props.strokeColor || '#202124';
  const fill =
    element.props.fillColor === 'transparent' ? 'none' : element.props.fillColor || 'none';
  const strokeWidth = Math.max(1, Math.min(6, element.props.strokeWidth || 2));
  const opacity = element.props.opacity ?? 1;
  const transform = `rotate(${(element.angle * 180) / Math.PI} ${element.x + element.width / 2} ${element.y + element.height / 2})`;

  if (element.type === 'ellipse') {
    return (
      <ellipse
        cx={element.x + element.width / 2}
        cy={element.y + element.height / 2}
        rx={Math.abs(element.width) / 2}
        ry={Math.abs(element.height) / 2}
        fill={fill}
        opacity={opacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        transform={transform}
      />
    );
  }

  if (element.type === 'line' || element.type === 'arrow') {
    const points = element.props.points ?? [
      [element.x, element.y],
      [element.x + element.width, element.y + element.height],
    ];
    return (
      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        opacity={opacity}
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    );
  }

  if (element.type === 'text') {
    return (
      <text
        x={element.x}
        y={element.y + (element.props.fontSize ?? 24)}
        fill={stroke}
        fontSize={element.props.fontSize ?? 24}
        opacity={opacity}
        transform={transform}
      >
        {(element.props.text ?? 'Text').slice(0, 42)}
      </text>
    );
  }

  if (element.type === 'image') {
    return (
      <image
        href={element.props.src ?? ''}
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        opacity={opacity}
        preserveAspectRatio="xMidYMid meet"
        transform={transform}
      />
    );
  }

  if (element.type === 'triangle') {
    return (
      <polygon
        points={trianglePoints(element.x, element.y, element.width, element.height)}
        fill={fill}
        opacity={opacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        transform={transform}
      />
    );
  }

  if (element.type === 'polygon') {
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    return (
      <polygon
        points={regularPolygonPoints(cx, cy, element.width / 2, element.height / 2)}
        fill={fill}
        opacity={opacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        transform={transform}
      />
    );
  }

  if (element.type === 'freehand' || element.type === 'highlighter') {
    return (
      <path
        d={buildFreehandPath(element.props.points)}
        fill="none"
        opacity={opacity}
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        transform={transform}
      />
    );
  }

  if (element.type === 'diamond') {
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    const points = [
      [cx, element.y],
      [element.x + element.width, cy],
      [cx, element.y + element.height],
      [element.x, cy],
    ];
    return (
      <polygon
        points={points.map(([x, y]) => `${x},${y}`).join(' ')}
        fill={fill}
        opacity={opacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        transform={transform}
      />
    );
  }

  return (
    <rect
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      fill={fill}
      opacity={opacity}
      rx="4"
      stroke={stroke}
      strokeWidth={strokeWidth}
      transform={transform}
    />
  );
}

function getBounds(
  elements: Element[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (!elements.length) return null;

  return elements.reduce(
    (bounds, element) => ({
      minX: Math.min(bounds.minX, element.x),
      minY: Math.min(bounds.minY, element.y),
      maxX: Math.max(bounds.maxX, element.x + element.width),
      maxY: Math.max(bounds.maxY, element.y + element.height),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
}

function previewTransform(bounds: {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}): string {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(300 / width, 195 / height, 1.8);
  const x = 180 - (bounds.minX + width / 2) * scale;
  const y = 128 - (bounds.minY + height / 2) * scale;
  return `translate(${x} ${y}) scale(${scale})`;
}

function buildGridPath(): string {
  const vertical = Array.from({ length: 18 }, (_, index) => `M${(index + 1) * 20} 0v255`);
  const horizontal = Array.from({ length: 12 }, (_, index) => `M0 ${(index + 1) * 20}h360`);
  return [...vertical, ...horizontal].join(' ');
}
