import type { Socket } from 'socket.io-client';
import type { Element } from '../../types/shared';

export type WhiteboardSocket = Socket;

export interface RoomSnapshotPayload {
  elements: Element[];
  documentClock: number;
}

export interface RoomDiffPayload {
  changed: Element[];
  deleted: Array<{ id: string }>;
  documentClock: number;
}

export interface ElementUpdatePayload {
  elements: Element[];
  sessionId?: string;
  documentClock?: number;
}

export interface CursorMovePayload {
  sessionId: string;
  cursor: { x: number; y: number } | null;
  viewport?: { x: number; y: number; zoom: number };
  selectedIds?: string[];
}
