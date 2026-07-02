import type { PrismaClient } from '@prisma/client';
import type { EffectiveRoomRole, Element, Presence, RoomRole } from '@vdt/shared';
import type { AppUser, AppUserRepository, AuthVerifier, VerifiedIdentity } from '../auth/index.js';
import type { AutosaveManager } from '../persistence/autosave.js';
import type { SyncRoom } from '../sync/index.js';
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
  syncRooms?: Map<string, SyncRoom>;
}

export interface ResolvedWhiteboardServerDeps {
  roomPresence: RoomPresenceStore;
  roomElements: RoomElementStore;
  roomClocks: RoomClockStore;
  autosave: AutosaveManager;
  db: PrismaClient;
  syncRooms: Map<string, SyncRoom>;
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

export interface RoomDiffRequestPayload {
  roomId: string;
  fromClock: number;
  toClock?: number;
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
    roomBaseRole?: EffectiveRoomRole;
    roomRole?: EffectiveRoomRole;
    roomRoleCapacityDowngraded?: boolean;
  }
}
