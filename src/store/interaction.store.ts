import { create } from 'zustand';
import type { Element, Presence } from '../types/shared';
import type { Point, Rect } from '../types/geometry';
import type { HandleId, InteractionState, ToolId } from '../types/interaction';

const DEFAULT_STATE: InteractionState = {
  tool: 'select',
  selectedIds: [],
  draggingId: null,
  dragStart: null,
  draftElement: null,
  marquee: null,
  resizeHandle: null,
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
  setResizeHandle: (h: HandleId | null) => void;
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
  setLaserTrail: (laserTrail) => set({ laserTrail }),
  setRemoteCursors: (remoteCursors) => set({ remoteCursors }),
  reset: () => set({ ...DEFAULT_STATE, remoteCursors: new Map() }),
}));
