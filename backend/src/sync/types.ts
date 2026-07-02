import type { PrismaClient } from '@prisma/client';
import type {
  CommittedChangeSet,
  EffectiveRoomRole,
  Element,
  RoomReplacedPayload,
  SyncClock,
} from '@vdt/shared';
import type { AutosaveManager } from '../persistence/autosave.js';
import type { SyncRoom } from './sync-room.js';

export type SyncCommand = LegacyElementUpdateCommand | NativeFileImportCommand;

export interface LegacyElementUpdateCommand {
  /**
   * Compatibility adapter for the pre-P5 saved-room socket event.
   * P5-02+ replaces this with shared slot-level SyncCommand contracts.
   */
  kind: 'legacy-element-update';
  roomId: string;
  elements: Element[];
  sessionId?: string;
}

export interface NativeFileImportCommand {
  /**
   * Compatibility adapter for the P4 native import HTTP surface.
   * It preserves current import behavior while preventing direct repository writes
   * outside the sync module boundary.
   */
  kind: 'native-file-import';
  roomId: string;
  elements: Element[];
}

export interface SyncActorContext {
  actorId: string | null;
  db: PrismaClient;
  effectiveRole?: EffectiveRoomRole;
  autosave?: AutosaveManager;
  roomElements?: Map<string, Map<string, Element>>;
  roomClocks?: Map<string, number>;
  // Shared hot-room registry. When provided, replace/import runs through the same
  // per-room actor as the socket command path, so the two paths cannot interleave.
  syncRooms?: Map<string, SyncRoom>;
  logger?: Pick<typeof console, 'error'>;
}

export type SyncCommandResult =
  | LegacyElementUpdateResult
  | NativeFileImportResult
  | ReplaceDocumentResult;

export interface LegacyElementUpdateResult {
  kind: 'legacy-element-update';
  roomId: string;
  elements: Element[];
  sessionId?: string;
  documentClock: number;
}

export interface NativeFileImportResult {
  kind: 'native-file-import';
  roomId: string;
  importedElementCount: number;
  documentClock: string | null;
  roomEpoch: SyncClock;
  replacePayload: RoomReplacedPayload;
}

export interface ReplaceDocumentResult {
  kind: 'replace-document';
  roomId: string;
  replacedElementCount: number;
  documentClock: string;
  roomEpoch: SyncClock;
  changeSet: CommittedChangeSet;
  replacePayload: RoomReplacedPayload;
}
