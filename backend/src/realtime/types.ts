import type { PrismaClient } from '@prisma/client';
import type { Element, Presence, RoomRole } from '@vdt/shared';
import type { AppUser, AppUserRepository, AuthVerifier, VerifiedIdentity } from '../auth/index.js';
import type { AutosaveManager } from '../persistence/autosave.js';
import type { RoomState } from './room-state.js';

export type RoomPresenceStore = Map<string, Map<string, Presence>>;
export type RoomElementStore = Map<string, Map<string, Element>>;
export type RoomClockStore = Map<string, number>;

export interface WhiteboardServerDeps extends Partial<RoomState> {
  roomPresence: RoomPresenceStore;
  roomElements: RoomElementStore;
  autosave: AutosaveManager;
  db?: PrismaClient;
  authVerifier?: AuthVerifier;
  appUserRepository?: AppUserRepository;
}

export interface ResolvedWhiteboardServerDeps {
  roomPresence: RoomPresenceStore;
  roomElements: RoomElementStore;
  roomClocks: RoomClockStore;
  autosave: AutosaveManager;
  db: PrismaClient;
}

export interface JoinRoomPayload {
  roomId: string;
  sessionId: string;
  name: string;
  color: string;
  lastServerClock?: number;
}

export interface ElementUpdatePayload {
  roomId: string;
  elements: Element[];
  sessionId?: string;
}

export interface RoomRoleUpdatePayload {
  roomId: string;
  userId: string;
  role: Extract<RoomRole, 'editor' | 'viewer'>;
}

export interface ElementDraftPayload {
  roomId: string;
  sessionId: string;
  elements: Element[];
}

export interface CursorMovePayload {
  roomId: string;
  sessionId: string;
  cursor: { x: number; y: number } | null;
  viewport?: { x: number; y: number; zoom: number };
  selectedIds?: string[];
}

declare module 'socket.io' {
  interface SocketData {
    sessionId: string;
    roomId: string;
    auth?: {
      identity: VerifiedIdentity;
      user?: AppUser;
    };
    roomRole?: RoomRole;
  }
}
