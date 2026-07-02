export type SyncRoomErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ELEMENT_NOT_FOUND'
  | 'ELEMENT_DELETED'
  | 'INVALID_SLOT'
  | 'INVALID_FIELD'
  | 'INVALID_VALUE'
  | 'INVALID_SLOT_FOR_ELEMENT_TYPE'
  | 'INVALID_BINDING_TARGET'
  | 'DUPLICATE_ELEMENT_ID'
  | 'DUPLICATE_REQUEST_CONFLICT'
  | 'TOO_LARGE'
  | 'CLOCK_OVERFLOW'
  | 'STALE_CLIENT_STATE'
  | 'STALE_ROOM_EPOCH'
  | 'FORBIDDEN'
  | 'INVALID_PERSISTENCE_POLICY'
  | 'ROOM_UNHEALTHY'
  | 'UNSUPPORTED_COMMAND'
  | 'UNSUPPORTED_PROTOCOL_VERSION'
  | 'UNSUPPORTED_SCHEMA_VERSION';

export class SyncRoomCommandError extends Error {
  constructor(
    readonly code: SyncRoomErrorCode,
    message: string = code,
    readonly details: readonly string[] = [],
  ) {
    super(message);
    this.name = 'SyncRoomCommandError';
  }
}
