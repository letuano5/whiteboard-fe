import type React from 'react';
import type { Camera, Element } from '../../../types/shared';
import type { HandleId } from '../../../types/interaction';

export interface SvgLayerProps {
  elements: Element[];
  camera: Camera;
  editingId?: string | null;
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerLeave?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  onContextMenu?: (e: React.MouseEvent<SVGSVGElement>) => void;
  onHandlePointerDown?: (handle: HandleId, e: React.PointerEvent<SVGCircleElement>) => void;
}

export interface MultiSelectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
