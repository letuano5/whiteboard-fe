import type { Point } from '../../../types/geometry';

interface SnapIndicatorsProps {
  points: Point[];
}

export default function SnapIndicators({ points }: SnapIndicatorsProps) {
  return (
    <>
      {points.map((point, index) => (
        <circle
          key={`snap-indicator-${index}`}
          cx={point.x}
          cy={point.y}
          r={6}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          opacity={0.7}
          style={{ pointerEvents: 'none' }}
        />
      ))}
    </>
  );
}
