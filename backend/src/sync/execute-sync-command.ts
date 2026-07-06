import { randomUUID } from 'node:crypto';
import {
  SYNC_PROTOCOL_VERSION,
  SYNC_SCHEMA_VERSION,
  type Element,
  type ReplaceDocumentCommand,
  type RoomReplacedPayload,
} from '@vdt/shared';
import { loadRoomElements } from '../persistence/room-repository.js';
import { captureIntervalSnapshotForCommit } from '../rooms/room-snapshots.js';
import { RoomActorRegistry } from './room-actor.js';
import { SyncRoom } from './sync-room.js';
import { withSyncRoom } from './sync-room-registry.js';
import { createPrismaSyncRoomPersistence } from './sync-room-persistence.js';
import type {
  NativeFileImportCommand,
  NativeFileImportResult,
  ReplaceDocumentResult,
  SyncActorContext,
} from './types.js';

const commandActors = new RoomActorRegistry();

interface ExecuteReplaceDocumentInput {
  roomId: string;
  elements: Element[];
  reason: ReplaceDocumentCommand['reason'];
  requestId?: string;
}

export function executeSyncCommand(
  command: NativeFileImportCommand,
  actorContext: SyncActorContext,
): Promise<NativeFileImportResult> {
  return commandActors.enqueue<NativeFileImportResult>(command.roomId, () =>
    executeNativeFileImport(command, actorContext),
  );
}

export function executeReplaceDocument(
  input: ExecuteReplaceDocumentInput,
  actorContext: SyncActorContext,
): Promise<ReplaceDocumentResult> {
  return commandActors.enqueue<ReplaceDocumentResult>(input.roomId, () =>
    executeReplaceDocumentInRoom(input, actorContext),
  );
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
  if (actorContext.syncRooms) {
    return withSyncRoom(actorContext.db, actorContext.syncRooms, input.roomId, (room) =>
      executeReplaceDocumentWithRoom(input, actorContext, room),
    );
  }

  const room = await createThrowawayReplaceTargetRoom(input.roomId, actorContext);
  return executeReplaceDocumentWithRoom(input, actorContext, room);
}

async function executeReplaceDocumentWithRoom(
  input: ExecuteReplaceDocumentInput,
  actorContext: SyncActorContext,
  room: SyncRoom,
): Promise<ReplaceDocumentResult> {
  const { documentClock, roomEpoch } = room.getStateSnapshot();
  const command: ReplaceDocumentCommand = {
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    kind: 'replace-document',
    roomId: input.roomId,
    requestId: input.requestId ?? `replace-document:${randomUUID()}`,
    clientClock: documentClock,
    baseRoomEpoch: roomEpoch,
    elements: input.elements,
    reason: input.reason,
  };
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

async function createThrowawayReplaceTargetRoom(
  roomId: string,
  actorContext: SyncActorContext,
): Promise<SyncRoom> {
  const loaded = await loadRoomElements(actorContext.db, roomId);
  return new SyncRoom({
    roomId,
    elements: loaded.elements,
    documentClock: loaded.documentClock,
    roomEpoch: loaded.roomEpoch,
    slotClocks: loaded.slotClocks,
    tombstoneElementIds: loaded.tombstoneElementIds,
    persistence: createPrismaSyncRoomPersistence(
      actorContext.db as unknown as Parameters<typeof createPrismaSyncRoomPersistence>[0],
      {
        afterCommit: async (commit) => {
          await captureIntervalSnapshotForCommit(
            actorContext.db as unknown as Parameters<typeof captureIntervalSnapshotForCommit>[0],
            commit,
          );
        },
      },
    ),
  });
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
