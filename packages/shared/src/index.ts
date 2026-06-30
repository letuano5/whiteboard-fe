// ─── Element model (§2.1) ────────────────────────────────────────────────────

export type ElementType =
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'text' // P1A
  | 'diamond'
  | 'triangle'
  | 'polygon' // P1B
  | 'arrow' // P2
  | 'image' // P2.5 — renders via SVG <image> / DOM <img>
  | 'freehand'
  | 'highlighter' // P3C — Canvas overlay
  | 'frame'
  | 'sticky'
  | 'embed'; // P4

export interface ElementProps {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  opacity: number;
  roughness?: number; // P4-10
  points?: [number, number][]; // line, arrow, freehand, highlighter
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  src?: string; // image
  startBinding?: string | null; // arrow
  endBinding?: string | null; // arrow
  url?: string; // embed
}

export interface Element {
  id: string;
  type: ElementType;
  x: number;
  y: number; // world coords, top-left of bounding box
  width: number;
  height: number;
  angle: number; // radians (P1A: always 0; P1B: general)
  zIndex: number; // integer for now
  props: ElementProps;

  version: number;
  versionNonce: number;
  updatedAt: number;
  isDeleted: boolean;

  groupId: string | null;
  frameId: string | null;
  locked: boolean;
  createdBy: string;
}

// ─── Camera (§2.2) ───────────────────────────────────────────────────────────

export interface Camera {
  x: number;
  y: number;
  zoom: number; // clamped [0.1, 8]
}

// ─── Presence (§2.4) — ephemeral, from P2 ────────────────────────────────────

export interface Presence {
  sessionId: string;
  userId?: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null; // world coords
  selectedIds: string[];
  status: 'active' | 'idle' | 'away';
  viewport?: { x: number; y: number; zoom: number };
}

// ─── WebSocket event constants ────────────────────────────────────────────────

export const WS_EVENTS = {
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  ELEMENT_CREATE: 'element-create',
  ELEMENT_UPDATE: 'element-update',
  ELEMENT_DELETE: 'element-delete',
  ELEMENT_DRAFT: 'element-draft',
  CURSOR_MOVE: 'cursor-move',
  USER_JOIN: 'user-join',
  USER_LEAVE: 'user-leave',
  ROOM_DIFF: 'room-diff', // AC-12: distinct WS event for reconnect incremental diff (P3A-03)
  ROOM_SNAPSHOT: 'room-snapshot',
  ROOM_RESYNC: 'room-resync',
} as const;

export type WsEvent = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];
