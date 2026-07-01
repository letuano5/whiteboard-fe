import { getRoomClock, saveRoomElements } from '../persistence/room-repository.js';
import type {
  LegacyElementUpdateCommand,
  LegacyElementUpdateResult,
  NativeFileImportCommand,
  NativeFileImportResult,
  SyncActorContext,
  SyncCommand,
  SyncCommandResult,
} from './types.js';

export function executeSyncCommand(
  command: LegacyElementUpdateCommand,
  actorContext: SyncActorContext,
): LegacyElementUpdateResult | Promise<LegacyElementUpdateResult>;
export function executeSyncCommand(
  command: NativeFileImportCommand,
  actorContext: SyncActorContext,
): Promise<NativeFileImportResult>;
export function executeSyncCommand(
  command: SyncCommand,
  actorContext: SyncActorContext,
): SyncCommandResult | Promise<SyncCommandResult> {
  switch (command.kind) {
    case 'legacy-element-update':
      return executeLegacyElementUpdate(command, actorContext);
    case 'native-file-import':
      return executeNativeFileImport(command, actorContext);
  }
}

function executeLegacyElementUpdate(
  command: LegacyElementUpdateCommand,
  actorContext: SyncActorContext,
): LegacyElementUpdateResult | Promise<LegacyElementUpdateResult> {
  const { roomElements, roomClocks, autosave } = actorContext;

  if (!roomElements || !roomClocks || !autosave) {
    throw new Error('legacy-element-update requires room state, room clocks, and autosave.');
  }

  if (!roomElements.has(command.roomId)) {
    roomElements.set(command.roomId, new Map());
  }
  const elementMap = roomElements.get(command.roomId)!;
  for (const element of command.elements) {
    elementMap.set(element.id, element);
  }

  if (!roomClocks.has(command.roomId)) {
    return loadRoomClockAndCommitLegacyElementUpdate(command, actorContext);
  }

  return commitLegacyElementUpdate(command, actorContext);
}

async function loadRoomClockAndCommitLegacyElementUpdate(
  command: LegacyElementUpdateCommand,
  actorContext: SyncActorContext,
): Promise<LegacyElementUpdateResult> {
  const { db, roomClocks, logger = console } = actorContext;

  try {
    roomClocks?.set(command.roomId, await getRoomClock(db, command.roomId));
  } catch (error) {
    logger.error(`[delta-clock] Failed to load room clock for ${command.roomId}:`, error);
    roomClocks?.set(command.roomId, 0);
  }

  return commitLegacyElementUpdate(command, actorContext);
}

function commitLegacyElementUpdate(
  command: LegacyElementUpdateCommand,
  actorContext: SyncActorContext,
): LegacyElementUpdateResult {
  const { roomClocks, autosave } = actorContext;

  if (!roomClocks || !autosave) {
    throw new Error('legacy-element-update requires room clocks and autosave.');
  }

  const documentClock = (roomClocks.get(command.roomId) ?? 0) + 1;
  roomClocks.set(command.roomId, documentClock);
  autosave.markDirty(command.roomId);

  return {
    kind: 'legacy-element-update',
    roomId: command.roomId,
    elements: command.elements,
    sessionId: command.sessionId,
    documentClock,
  };
}

async function executeNativeFileImport(
  command: NativeFileImportCommand,
  actorContext: SyncActorContext,
): Promise<NativeFileImportResult> {
  const result = await saveRoomElements(actorContext.db, command.roomId, command.elements);

  return {
    kind: 'native-file-import',
    roomId: command.roomId,
    importedElementCount: command.elements.length,
    documentClock: result?.documentClock.toString() ?? null,
  };
}
