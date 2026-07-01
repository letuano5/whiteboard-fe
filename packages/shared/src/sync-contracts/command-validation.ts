import {
  isElementLike,
  isFiniteNumber,
  isOrderHint,
  isReadPreconditions,
  isRecord,
} from './guards';
import { validateSlotPatch } from './slot-validation';
import {
  SYNC_PROTOCOL_VERSION,
  SYNC_SCHEMA_VERSION,
  type CreateValidationContext,
  type SyncCommand,
  type SyncValidationResult,
} from './types';

export function validateSyncCommand(
  value: unknown,
  createContext: CreateValidationContext = {},
): SyncValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return invalid('SyncCommand must be an object.');
  }
  validateEnvelope(value, errors);
  if ('actorId' in value) {
    errors.push('SyncCommand payload must not include actorId.');
  }

  switch (value.kind) {
    case 'create-element':
      validateCreateElementCommand(value, createContext, errors);
      break;
    case 'patch-slots':
      validatePatchSlotsCommand(value, errors);
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
    case 'replace-document':
      validateReplaceDocumentCommand(value, errors);
      break;
    default:
      errors.push('SyncCommand kind is not supported.');
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

function validateCreateElementCommand(
  value: Record<string, unknown>,
  context: CreateValidationContext,
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

function validatePatchSlotsCommand(value: Record<string, unknown>, errors: string[]): void {
  if (!Array.isArray(value.patches) || value.patches.length === 0) {
    errors.push('PatchSlotsCommand.patches must be a non-empty array.');
    return;
  }

  const seen = new Set<string>();
  for (const patch of value.patches) {
    validateSlotPatch(patch, errors);
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
  if (typeof value.elementId !== 'string') {
    errors.push('UpdateArrowBindingCommand.elementId is required.');
  }
  if (!isFiniteNumber(value.baseBindingClock)) {
    errors.push('UpdateArrowBindingCommand.baseBindingClock is required.');
  }
  if (
    value.startBinding !== undefined &&
    typeof value.startBinding !== 'string' &&
    value.startBinding !== null
  ) {
    errors.push('UpdateArrowBindingCommand.startBinding is invalid.');
  }
  if (
    value.endBinding !== undefined &&
    typeof value.endBinding !== 'string' &&
    value.endBinding !== null
  ) {
    errors.push('UpdateArrowBindingCommand.endBinding is invalid.');
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
    value.reason !== 'manual-replace'
  ) {
    errors.push('ReplaceDocumentCommand.reason is invalid.');
  }
}

function invalid(error: string): SyncValidationResult {
  return { ok: false, errors: [error] };
}
