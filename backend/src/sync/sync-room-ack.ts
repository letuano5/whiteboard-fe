import type { SyncAck, SyncClock, SyncCommand } from '@vdt/shared';
import { SYNC_PROTOCOL_VERSION, SYNC_SCHEMA_VERSION } from '@vdt/shared';
import type { SyncRoomExecutionResult } from './sync-room.js';
import { SyncRoomCommandError } from './sync-room-errors.js';

export function createSyncAck(result: SyncRoomExecutionResult): SyncAck {
  const status = result.changeSet.reason === 'patch_lww_conflict' ? 'rebase' : 'commit';

  return {
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId: result.command.roomId,
    requestId: result.command.requestId,
    serverClock: result.changeSet.serverClock,
    status,
    changeSet: result.changeSet,
  };
}

export function createSyncRejectAck(
  command: SyncCommand,
  error: unknown,
  serverClock: SyncClock,
): SyncAck {
  return {
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId: command.roomId,
    requestId: command.requestId,
    serverClock,
    status: 'reject',
    reason: error instanceof SyncRoomCommandError ? error.code : 'INVALID_VALUE',
  };
}
