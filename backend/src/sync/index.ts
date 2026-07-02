export { executeReplaceDocument, executeSyncCommand } from './execute-sync-command.js';
export { RoomActor, RoomActorRegistry } from './room-actor.js';
export { createSyncAck, createSyncRejectAck } from './sync-room-ack.js';
export { SyncRoom } from './sync-room.js';
export { SyncRoomCommandError } from './sync-room-errors.js';
export {
  SyncRoomPersistenceError,
  createPrismaSyncRoomPersistence,
  resolveSyncCommandPersistencePolicy,
  toProcessedRequestActorId,
} from './sync-room-persistence.js';
export {
  MAX_CHANGESET_BYTES,
  MAX_ELEMENTS_PER_DELETE,
  MAX_PATCHES_PER_COMMAND,
  MAX_POINTS_PER_STROKE,
  MAX_REPAIRED_ARROWS_PER_COMMAND,
} from './sync-room-limits.js';
export type {
  SyncRoomActorContext,
  SyncRoomCommitOutcome,
  SyncRoomExecutionResult,
  SyncRoomPlan,
  SyncRoomPersistence,
  SyncRoomPersistenceCommit,
  SyncRoomPersistenceDurability,
  SyncRoomPersistencePolicy,
  SyncRoomProcessedRequest,
  SyncRoomPlanner,
  SyncRoomPlannerContext,
  SyncRoomReferenceValidator,
  SyncRoomReloadState,
  SyncRoomStateSnapshot,
} from './sync-room.js';
export type { SyncRoomErrorCode } from './sync-room-errors.js';
export type {
  LegacyElementUpdateCommand,
  LegacyElementUpdateResult,
  NativeFileImportCommand,
  NativeFileImportResult,
  ReplaceDocumentResult,
  SyncActorContext,
  SyncCommand,
  SyncCommandResult,
} from './types.js';
