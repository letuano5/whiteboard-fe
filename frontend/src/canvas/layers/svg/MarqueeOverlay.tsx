import type { Rect } from '../../../types/geometry';

interface MarqueeOverlayProps {
  marquee: Rect | null;
}

export default function MarqueeOverlay({ marquee }: MarqueeOverlayProps) {
  if (!marquee) return null;

  return (
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
  );
}
