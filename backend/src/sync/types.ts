import type { PrismaClient } from '@prisma/client';
import type { Element } from '@vdt/shared';
import type { AutosaveManager } from '../persistence/autosave.js';

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
  autosave?: AutosaveManager;
  roomElements?: Map<string, Map<string, Element>>;
  roomClocks?: Map<string, number>;
  logger?: Pick<typeof console, 'error'>;
}

export type SyncCommandResult = LegacyElementUpdateResult | NativeFileImportResult;

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
}
