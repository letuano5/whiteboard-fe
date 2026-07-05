import {
  MousePointer2,
  Hand,
  Square,
  Circle,
  Diamond,
  Triangle,
  Hexagon,
  Minus,
  ArrowRight,
  Type,
  Zap,
  Pencil,
  Highlighter,
  Eraser,
} from 'lucide-react';
import type { ToolId } from '../../types/interaction';

export interface ToolButtonConfig {
  id: ToolId;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
}

/** Always visible in the main toolbar row. */
export const FIXED_TOOLS: ToolButtonConfig[] = [
  { id: 'select', label: 'Select', Icon: MousePointer2 },
  { id: 'rectangle', label: 'Rectangle', Icon: Square },
  { id: 'ellipse', label: 'Ellipse', Icon: Circle },
  { id: 'line', label: 'Line', Icon: Minus },
  { id: 'arrow', label: 'Arrow', Icon: ArrowRight },
  { id: 'text', label: 'Text', Icon: Type },
  { id: 'eraser', label: 'Eraser', Icon: Eraser },
];

/** Tucked behind the "More tools" overflow menu. */
export const OVERFLOW_TOOLS: ToolButtonConfig[] = [
  { id: 'hand', label: 'Hand', Icon: Hand },
  { id: 'diamond', label: 'Diamond', Icon: Diamond },
  { id: 'triangle', label: 'Triangle', Icon: Triangle },
  { id: 'polygon', label: 'Polygon', Icon: Hexagon },
  { id: 'freehand', label: 'Freehand', Icon: Pencil },
  { id: 'highlighter', label: 'Highlighter', Icon: Highlighter },
  { id: 'laser', label: 'Laser', Icon: Zap },
];
