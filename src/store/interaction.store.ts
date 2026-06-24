import { create } from 'zustand';
import type { Element, Presence } from '../types/shared';
import type { Point, Rect } from '../types/geometry';
import type {
  InteractionState,
  ResizeHandleId,
  ResizeSession,
  ToolId,
} from '../types/interaction';

const DEFAULT_STATE: InteractionState = {
  tool: 'select',
  selectedIds: [],
  draggingId: null,
  dragStart: null,
  draftElement: null,
  marquee: null,
  resizeHandle: null,
  resizeSession: null,
  isRotating: false,
  laserTrail: [],
  remoteCursors: new Map(),
};

interface InteractionActions {
  setTool: (tool: ToolId) => void;
  setSelectedIds: (ids: string[]) => void;
  setDraggingId: (id: string | null) => void;
  setDragStart: (pt: Point | null) => void;
  setDraftElement: (el: Element | null) => void;
  setMarquee: (rect: Rect | null) => void;
  setResizeHandle: (h: ResizeHandleId | null) => void;
  setResizeSession: (session: ResizeSession | null) => void;
  setIsRotating: (v: boolean) => void;
  setLaserTrail: (trail: Point[]) => void;
  setRemoteCursors: (cursors: Map<string, Presence>) => void;
  reset: () => void;
}

export const useInteractionStore = create<InteractionState & InteractionActions>()((set) => ({
  ...DEFAULT_STATE,

  setTool: (tool) => set({ tool }),
  setSelectedIds: (selectedIds) => set({ selectedIds }),
  setDraggingId: (draggingId) => set({ draggingId }),
  setDragStart: (dragStart) => set({ dragStart }),
  setDraftElement: (draftElement) => set({ draftElement }),
  setMarquee: (marquee) => set({ marquee }),
  setResizeHandle: (resizeHandle) => set({ resizeHandle }),
  setResizeSession: (resizeSession) => set({ resizeSession }),
  setIsRotating: (isRotating) => set({ isRotating }),
  setLaserTrail: (laserTrail) => set({ laserTrail }),
  setRemoteCursors: (remoteCursors) => set({ remoteCursors }),
  reset: () => set({ ...DEFAULT_STATE, remoteCursors: new Map() }),
}));
