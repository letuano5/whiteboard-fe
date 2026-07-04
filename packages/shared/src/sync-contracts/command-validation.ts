import {
  isArrowEndpointBinding,
  isElementLike,
  isFiniteNumber,
  isOrderHint,
  isReadPreconditions,
  isRecord,
} from './guards';
import { hasSyncCommandKind } from './command-kind';
import { getCurrentSlotClock, getStaleReadPreconditions } from './read-preconditions';
import { validateSlotPatch } from './slot-validation';
import {
  SYNC_PROTOCOL_VERSION,
  SYNC_SCHEMA_VERSION,
  type SyncCommand,
  type SyncSlot,
  type SyncValidationContext,
  type SyncValidationResult,
} from './types';

export function validateSyncCommand(
  value: unknown,
  context: SyncValidationContext = {},
): SyncValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: ['SyncCommand must be an object.'] };
  }
  validateEnvelope(value, errors);
  validatePersistenceHints(value, errors);
  if ('actorId' in value) {
    errors.push('SyncCommand payload must not include actorId.');
  }
  if ('batchId' in value) {
    errors.push('SyncCommand must not include batchId.');
  }

  switch (value.kind) {
    case 'create-element':
      validateCreateElementCommand(value, context, errors);
      break;
    case 'patch-slots':
      validatePatchSlotsCommand(value, context, errors);
      break;
    case 'reorder-elements':
      validateReorderElementsCommand(value, errors);
      break;
    case 'update-arrow-binding':
      validateUpdateArrowBindingCommand(value, errors);
      break;
    case 'delete-elements':
      validateDeleteElementsCommand(value, errors);
      break;
    case 'restore-elements':
      validateRestoreElementsCommand(value, context, errors);
      break;
    case 'replace-document':
      validateReplaceDocumentCommand(value, errors);
      break;
    default:
      errors.push('SyncCommand kind is not supported.');
  }

  if (hasSyncCommandKind(value)) {
    for (const stale of getStaleReadPreconditions(value as unknown as SyncCommand, context)) {
      if (stale.onStale === 'reject') {
        errors.push('STALE_CLIENT_STATE');
      }
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function isSyncCommand(value: unknown): value is SyncCommand {
  return validateSyncCommand(value).ok;
}

function validateEnvelope(value: Record<string, unknown>, errors: string[]): void {
  if (value.protocolVersion !== SYNC_PROTOCOL_VERSION) errors.push('protocolVersion is invalid.');
  if (value.schemaVersion !== SYNC_SCHEMA_VERSION) errors.push('schemaVersion is invalid.');
  if (typeof value.roomId !== 'string' || value.roomId.length === 0) {
    errors.push('roomId is required.');
  }
  if (typeof value.requestId !== 'string' || value.requestId.length === 0) {
    errors.push('requestId is required.');
  }
  if (!isFiniteNumber(value.clientClock)) errors.push('clientClock is required.');
  if (!isFiniteNumber(value.baseRoomEpoch)) errors.push('baseRoomEpoch is required.');
  if (value.readPreconditions !== undefined && !isReadPreconditions(value.readPreconditions)) {
    errors.push('readPreconditions is invalid.');
  }
}

function validatePersistenceHints(value: Record<string, unknown>, errors: string[]): void {
  if (value.persistence === undefined) return;
  if (!isRecord(value.persistence)) {
    errors.push('SyncCommand.persistence is invalid.');
    return;
  }

  const hints = value.persistence;
  const transient = hints.transient === true;
  const resendable = hints.resendable === undefined ? !transient : hints.resendable;
  const storeProcessedRequest =
    hints.storeProcessedRequest === undefined ? resendable : hints.storeProcessedRequest;
  const durability = hints.durability ?? (transient ? 'relaxed' : 'durable');

  if (hints.transient !== undefined && typeof hints.transient !== 'boolean') {
    errors.push('SyncCommand.persistence.transient is invalid.');
  }
  if (hints.resendable !== undefined && typeof hints.resendable !== 'boolean') {
    errors.push('SyncCommand.persistence.resendable is invalid.');
  }
  if (
    hints.storeProcessedRequest !== undefined &&
    typeof hints.storeProcessedRequest !== 'boolean'
  ) {
    errors.push('SyncCommand.persistence.storeProcessedRequest is invalid.');
  }
  if (durability !== 'durable' && durability !== 'relaxed') {
    errors.push('SyncCommand.persistence.durability is invalid.');
  }
  if (storeProcessedRequest === false && resendable) {
    errors.push('Resendable SyncCommand must store ProcessedRequest.');
  }
  if (transient && (value.kind !== 'patch-slots' || resendable || storeProcessedRequest)) {
    errors.push('Only non-resendable patch-slot commands may be transient.');
  }
  if (!transient && durability === 'relaxed') {
    errors.push('Only transient commands may request relaxed durability.');
  }
}

function validateCreateElementCommand(
  value: Record<string, unknown>,
  context: SyncValidationContext,
  errors: string[],
): void {
  if (!isElementLike(value.element)) {
    errors.push('CreateElementCommand.element must be a full Element.');
    return;
  }
  if (context.activeElementIds?.has(value.element.id)) {
    errors.push('CreateElementCommand element id already exists.');
  }
  if (context.tombstoneElementIds?.has(value.element.id)) {
    errors.push('CreateElementCommand element id is inside tombstone retention.');
  }
  if (value.orderHint !== undefined && !isOrderHint(value.orderHint)) {
    errors.push('CreateElementCommand.orderHint is invalid.');
  }
}

function validatePatchSlotsCommand(
  value: Record<string, unknown>,
  context: SyncValidationContext,
  errors: string[],
): void {
  if (!Array.isArray(value.patches) || value.patches.length === 0) {
    errors.push('PatchSlotsCommand.patches must be a non-empty array.');
    return;
  }

  const seen = new Set<string>();
  for (const patch of value.patches) {
    validateSlotPatch(
      patch,
      errors,
      context.currentSlotClocks
        ? (elementId: string, slot: SyncSlot) => getCurrentSlotClock(context, elementId, slot)
        : undefined,
    );
    if (!isRecord(patch) || typeof patch.elementId !== 'string' || typeof patch.slot !== 'string') {
      continue;
    }
    const key = `${patch.elementId}:${patch.slot}`;
    if (seen.has(key)) {
      errors.push('PatchSlotsCommand contains duplicate element slot patches.');
    }
    seen.add(key);
  }
}

function validateReorderElementsCommand(value: Record<string, unknown>, errors: string[]): void {
  if (!Array.isArray(value.moves) || value.moves.length === 0) {
    errors.push('ReorderElementsCommand.moves must be a non-empty array.');
    return;
  }
  for (const move of value.moves) {
    if (!isRecord(move) || typeof move.elementId !== 'string' || !isOrderHint(move)) {
      errors.push('ReorderElementsCommand.move is invalid.');
    }
  }
}

function validateUpdateArrowBindingCommand(value: Record<string, unknown>, errors: string[]): void {
  if (typeof value.arrowId !== 'string') {
    errors.push('UpdateArrowBindingCommand.arrowId is required.');
  }
  if (value.terminal !== 'start' && value.terminal !== 'end') {
    errors.push('UpdateArrowBindingCommand.terminal is invalid.');
  }
  if (value.binding !== null && !isArrowEndpointBinding(value.binding)) {
    errors.push('UpdateArrowBindingCommand.binding is invalid.');
  }
  if (!isFiniteNumber(value.baseBindingClock)) {
    errors.push('UpdateArrowBindingCommand.baseBindingClock is required.');
  }
  if (!isFiniteNumber(value.baseGeometryClock)) {
    errors.push('UpdateArrowBindingCommand.baseGeometryClock is required.');
  }
}

function validateDeleteElementsCommand(value: Record<string, unknown>, errors: string[]): void {
  if (
    !Array.isArray(value.elementIds) ||
    value.elementIds.length === 0 ||
    !value.elementIds.every((id) => typeof id === 'string')
  ) {
    errors.push('DeleteElementsCommand.elementIds must be a non-empty string array.');
  }
}

function validateRestoreElementsCommand(
  value: Record<string, unknown>,
  context: SyncValidationContext,
  errors: string[],
): void {
  if (
    !Array.isArray(value.elements) ||
    value.elements.length === 0 ||
    !value.elements.every((element) => isElementLike(element))
  ) {
    errors.push('RestoreElementsCommand.elements must contain full Elements.');
    return;
  }

  for (const element of value.elements) {
    if (context.activeElementIds?.has(element.id)) {
      errors.push('RestoreElementsCommand element id already exists.');
    }
    if (context.tombstoneElementIds !== undefined && !context.tombstoneElementIds.has(element.id)) {
      errors.push('RestoreElementsCommand element id is not tombstoned.');
    }
  }
}

function validateReplaceDocumentCommand(value: Record<string, unknown>, errors: string[]): void {
  if (
    !Array.isArray(value.elements) ||
    !value.elements.every((element) => isElementLike(element))
  ) {
    errors.push('ReplaceDocumentCommand.elements must contain full Elements.');
  }
  if (
    value.reason !== 'import' &&
    value.reason !== 'restore' &&
    value.reason !== 'manual_replace'
  ) {
    errors.push('ReplaceDocumentCommand.reason is invalid.');
  }
}
