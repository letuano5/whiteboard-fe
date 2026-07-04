import type { Point } from '../../../types/geometry';

interface LaserTrailOverlayProps {
  laserTrail: Point[];
  laserFading: boolean;
}

export default function LaserTrailOverlay({ laserTrail, laserFading }: LaserTrailOverlayProps) {
  if (laserTrail.length < 2) return null;

  return (
    <polyline
      points={laserTrail.map((point) => `${point.x},${point.y}`).join(' ')}
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
  );
}
