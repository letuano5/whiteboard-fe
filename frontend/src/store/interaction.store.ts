import { create } from 'zustand';
import type { Element, Presence } from '../types/shared';
import type { Point, Rect } from '../types/geometry';
import type { HandleId, InteractionState, ResizeSession, ToolId } from '../types/interaction';

const DEFAULT_STATE: InteractionState = {
  tool: 'select',
  selectedIds: [],
  draggingId: null,
  dragStart: null,
  draftElement: null,
  draftElements: [],
  marquee: null,
  resizeHandle: null,
  resizeSession: null,
  groupResizeSession: null,
  isRotating: false,
  editingId: null,
  laserTrail: [],
  laserFading: false,
  remoteCursors: new Map(),
  remoteDrafts: new Map(),
  clipboard: null,
  pasteOffset: 0,
};

interface InteractionActions {
  setTool: (tool: ToolId) => void;
  setSelectedIds: (ids: string[]) => void;
  setDraggingId: (id: string | null) => void;
  setDragStart: (pt: Point | null) => void;
  setDraftElement: (el: Element | null) => void;
  setDraftElements: (els: Element[]) => void;
  setMarquee: (rect: Rect | null) => void;
  setResizeHandle: (h: HandleId | null) => void;
  setResizeSession: (session: ResizeSession | null) => void;
  setGroupResizeSession: (session: InteractionState['groupResizeSession']) => void;
  setIsRotating: (v: boolean) => void;
  setEditingId: (id: string | null) => void;
  setLaserTrail: (trail: Point[]) => void;
  setLaserFading: (v: boolean) => void;
  setRemoteCursors: (cursors: Map<string, Presence>) => void;
  setRemoteDrafts: (drafts: Map<string, Element[]>) => void;
  setClipboard: (els: Element[] | null) => void;
  setPasteOffset: (n: number) => void;
  reset: () => void;
}

export const useInteractionStore = create<InteractionState & InteractionActions>()((set) => ({
  ...DEFAULT_STATE,

  setTool: (tool) => set({ tool }),
  setSelectedIds: (selectedIds) => set({ selectedIds }),
  setDraggingId: (draggingId) => set({ draggingId }),
  setDragStart: (dragStart) => set({ dragStart }),
  setDraftElement: (draftElement) => set({ draftElement }),
  setDraftElements: (draftElements) => set({ draftElements }),
  setMarquee: (marquee) => set({ marquee }),
  setResizeHandle: (resizeHandle) => set({ resizeHandle }),
  setResizeSession: (resizeSession) => set({ resizeSession }),
  setGroupResizeSession: (groupResizeSession) => set({ groupResizeSession }),
  setIsRotating: (isRotating) => set({ isRotating }),
  setEditingId: (editingId) => set({ editingId }),
  setLaserTrail: (laserTrail) => set({ laserTrail }),
  setLaserFading: (laserFading) => set({ laserFading }),
  setRemoteCursors: (remoteCursors) => set({ remoteCursors }),
  setRemoteDrafts: (remoteDrafts) => set({ remoteDrafts }),
  setClipboard: (clipboard) => set({ clipboard }),
  setPasteOffset: (pasteOffset) => set({ pasteOffset }),
  reset: () => set({ ...DEFAULT_STATE, remoteCursors: new Map(), remoteDrafts: new Map() }),
}));
