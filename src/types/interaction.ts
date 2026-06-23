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
  marquee: Rect | null;
  resizeHandle: ResizeHandleId | null;
  resizeSession: ResizeSession | null;
  laserTrail: Point[];
  remoteCursors: Map<string, Presence>;
}
