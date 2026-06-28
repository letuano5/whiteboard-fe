import type { Element, Presence } from './shared';
import type { Point, Rect } from './geometry';

export type ToolId =
  | 'select'
  | 'hand'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'text'
  | 'diamond'
  | 'triangle'
  | 'polygon'
  | 'arrow'
  | 'image'
  | 'freehand'
  | 'highlighter'
  | 'eraser'
  | 'frame'
  | 'sticky'
  | 'embed'
  | 'laser';

export type HandleId = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'rotate';
export type ResizeHandleId = Exclude<HandleId, 'rotate'>;

export interface ResizeSession {
  originalBounds: Rect;
  originalHandle: ResizeHandleId;
  anchor: Point;
}

export interface InteractionState {
  tool: ToolId;
  selectedIds: string[];
  draggingId: string | null;
  dragStart: Point | null;
  draftElement: Element | null;
  draftElements: Element[];
  marquee: Rect | null;
  resizeHandle: ResizeHandleId | null;
  resizeSession: ResizeSession | null;
  isRotating: boolean;
  editingId: string | null;
  laserTrail: Point[];
  laserFading: boolean;
  remoteCursors: Map<string, Presence>;
  remoteDrafts: Map<string, Element[]>;
  clipboard: Element[] | null;
  pasteOffset: number;
}
