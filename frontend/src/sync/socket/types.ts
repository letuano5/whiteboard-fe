import type { Socket } from 'socket.io-client';
import type {
  Element,
  RoomAccessErrorPayload,
  RoomAccessPayload,
  RoomDiff,
  RoomSnapshot,
} from '../../types/shared';

export type WhiteboardSocket = Socket;

export type RoomSnapshotPayload = RoomSnapshot & { documentClock?: number };

export type RoomDiffPayload = RoomDiff & { documentClock?: number };

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

export type { RoomAccessErrorPayload, RoomAccessPayload };
