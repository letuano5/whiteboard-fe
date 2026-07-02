import { randomUUID } from 'node:crypto';
import {
  SYNC_PROTOCOL_VERSION,
  SYNC_SCHEMA_VERSION,
  type Element,
  type ReplaceDocumentCommand,
  type RoomReplacedPayload,
} from '@vdt/shared';
import { getRoomClock, loadRoomElements } from '../persistence/room-repository.js';
import { RoomActorRegistry } from './room-actor.js';
import { SyncRoom } from './sync-room.js';
import { createPrismaSyncRoomPersistence } from './sync-room-persistence.js';
import type {
  LegacyElementUpdateCommand,
  LegacyElementUpdateResult,
  NativeFileImportCommand,
  NativeFileImportResult,
  ReplaceDocumentResult,
  SyncActorContext,
  SyncCommand,
  SyncCommandResult,
} from './types.js';

const commandActors = new RoomActorRegistry();

interface ExecuteReplaceDocumentInput {
  roomId: string;
  elements: Element[];
  reason: ReplaceDocumentCommand['reason'];
  requestId?: string;
}

export function executeSyncCommand(
  command: LegacyElementUpdateCommand,
  actorContext: SyncActorContext,
): Promise<LegacyElementUpdateResult>;
export function executeSyncCommand(
  command: NativeFileImportCommand,
  actorContext: SyncActorContext,
): Promise<NativeFileImportResult>;
export function executeSyncCommand(
  command: SyncCommand,
  actorContext: SyncActorContext,
): SyncCommandResult | Promise<SyncCommandResult> {
  return commandActors.enqueue<SyncCommandResult>(command.roomId, () => {
    switch (command.kind) {
      case 'legacy-element-update':
        return executeLegacyElementUpdate(command, actorContext);
      case 'native-file-import':
        return executeNativeFileImport(command, actorContext);
    }
  });
}

export function executeReplaceDocument(
  input: ExecuteReplaceDocumentInput,
  actorContext: SyncActorContext,
): Promise<ReplaceDocumentResult> {
  return commandActors.enqueue<ReplaceDocumentResult>(input.roomId, () =>
    executeReplaceDocumentInRoom(input, actorContext),
  );
}

async function executeLegacyElementUpdate(
  command: LegacyElementUpdateCommand,
  actorContext: SyncActorContext,
): Promise<LegacyElementUpdateResult> {
  const { roomElements, roomClocks, autosave } = actorContext;

  if (!roomElements || !roomClocks || !autosave) {
    throw new Error('legacy-element-update requires room state, room clocks, and autosave.');
  }

  if (!roomClocks.has(command.roomId)) {
    await loadRoomClock(command, actorContext);
  }

  if (!roomElements.has(command.roomId)) {
    roomElements.set(command.roomId, new Map());
  }
  const elementMap = roomElements.get(command.roomId)!;
  for (const element of command.elements) {
    elementMap.set(element.id, element);
  }

  return commitLegacyElementUpdate(command, actorContext);
}

async function loadRoomClock(
  command: LegacyElementUpdateCommand,
  actorContext: SyncActorContext,
): Promise<void> {
  const { db, roomClocks, logger = console } = actorContext;

  try {
    roomClocks?.set(command.roomId, await getRoomClock(db, command.roomId));
  } catch (error) {
    logger.error(`[delta-clock] Failed to load room clock for ${command.roomId}:`, error);
    roomClocks?.set(command.roomId, 0);
  }
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
  const result = await executeReplaceDocumentInRoom(
    {
      roomId: command.roomId,
      elements: command.elements,
      reason: 'import',
      requestId: `native-file-import:${randomUUID()}`,
    },
    actorContext,
  );

  return {
    kind: 'native-file-import',
    roomId: command.roomId,
    importedElementCount: command.elements.length,
    documentClock: result.documentClock,
    roomEpoch: result.roomEpoch,
    replacePayload: result.replacePayload,
  };
}

async function executeReplaceDocumentInRoom(
  input: ExecuteReplaceDocumentInput,
  actorContext: SyncActorContext,
): Promise<ReplaceDocumentResult> {
  const loaded = await loadRoomElements(actorContext.db, input.roomId);
  const command: ReplaceDocumentCommand = {
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    kind: 'replace-document',
    roomId: input.roomId,
    requestId: input.requestId ?? `replace-document:${randomUUID()}`,
    clientClock: loaded.documentClock,
    baseRoomEpoch: loaded.roomEpoch,
    elements: input.elements,
    reason: input.reason,
  };
  const room = new SyncRoom({
    roomId: input.roomId,
    elements: loaded.elements,
    documentClock: loaded.documentClock,
    roomEpoch: loaded.roomEpoch,
    slotClocks: loaded.slotClocks,
    tombstoneElementIds: loaded.tombstoneElementIds,
    persistence: createPrismaSyncRoomPersistence(
      actorContext.db as unknown as Parameters<typeof createPrismaSyncRoomPersistence>[0],
    ),
  });
  const result = await room.execute(command, {
    actorId: actorContext.actorId,
    effectiveRole: actorContext.effectiveRole,
  });

  return {
    kind: 'replace-document',
    roomId: input.roomId,
    replacedElementCount: input.elements.length,
    documentClock: result.changeSet.serverClock.toString(),
    roomEpoch: result.changeSet.roomEpoch,
    changeSet: result.changeSet,
    replacePayload: toRoomReplacedPayload(result.changeSet),
  };
}

function toRoomReplacedPayload(changeSet: ReplaceDocumentResult['changeSet']): RoomReplacedPayload {
  return {
    protocolVersion: changeSet.protocolVersion,
    schemaVersion: changeSet.schemaVersion,
    roomId: changeSet.roomId,
    serverClock: changeSet.serverClock,
    roomEpoch: changeSet.roomEpoch,
    elements: changeSet.puts.length > 0 ? changeSet.puts : changeSet.created,
    slotClocks: changeSet.slotClocks,
  };
}
