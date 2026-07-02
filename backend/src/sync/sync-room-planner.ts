import {
  validateSyncCommand,
  type DeleteElementsCommand,
  type Element,
  type PatchSlotsCommand,
  type SlotPatch,
} from '@vdt/shared';
import { SyncRoomCommandError, type SyncRoomErrorCode } from './sync-room-errors.js';
import { MAX_ELEMENTS_PER_DELETE, MAX_PATCHES_PER_COMMAND } from './sync-room-limits.js';
import { applySlotPatch, validateSlotForElement } from './sync-room-slot-patches.js';
import type { SyncRoomPlan, SyncRoomPlannerContext } from './sync-room.js';

export function defaultSyncRoomPlanner(context: SyncRoomPlannerContext): SyncRoomPlan {
  validateCommandBoundary(context);

  switch (context.command.kind) {
    case 'create-element':
      return {
        created: [context.command.element],
        normalizedOrder: [
          { elementId: context.command.element.id, zIndex: context.command.element.zIndex },
        ],
      };
    case 'patch-slots':
      return planPatchSlots(context, context.command);
    case 'delete-elements':
      return planDeleteElements(context, context.command);
    case 'replace-document': {
      const replacementIds = new Set(context.command.elements.map((element) => element.id));
      return {
        created: context.command.elements,
        deleted: [...context.state.elements.keys()].filter(
          (elementId) => !replacementIds.has(elementId),
        ),
        roomEpoch: context.state.roomEpoch + 1,
        normalizedOrder: context.command.elements.map((element) => ({
          elementId: element.id,
          zIndex: element.zIndex,
        })),
      };
    }
    default:
      throw new SyncRoomCommandError(
        'UNSUPPORTED_COMMAND',
        `${context.command.kind} planning is owned by later P5 phases.`,
      );
  }
}

function validateCommandBoundary(context: SyncRoomPlannerContext): void {
  const validation = validateSyncCommand(context.command, {
    activeElementIds: new Set(context.state.elements.keys()),
    tombstoneElementIds: context.state.tombstoneElementIds,
    currentSlotClocks: context.state.slotClocks,
  });
  if (!validation.ok) {
    throw new SyncRoomCommandError(
      mapValidationErrors(validation.errors),
      'Invalid sync command.',
      [...validation.errors],
    );
  }
  if (context.command.baseRoomEpoch !== context.state.roomEpoch) {
    throw new SyncRoomCommandError('STALE_ROOM_EPOCH');
  }
}

function mapValidationErrors(errors: readonly string[]): SyncRoomErrorCode {
  if (errors.includes('protocolVersion is invalid.')) return 'UNSUPPORTED_PROTOCOL_VERSION';
  if (errors.includes('schemaVersion is invalid.')) return 'UNSUPPORTED_SCHEMA_VERSION';
  if (errors.includes('STALE_CLIENT_STATE')) return 'STALE_CLIENT_STATE';
  if (errors.some((error) => error.includes('already exists'))) return 'DUPLICATE_ELEMENT_ID';
  if (errors.some((error) => error.includes('tombstone retention'))) return 'DUPLICATE_ELEMENT_ID';
  if (errors.some((error) => error.includes('duplicate element slot'))) return 'INVALID_SLOT';
  if (errors.some((error) => error.includes('SlotPatch.slot is invalid'))) return 'INVALID_SLOT';
  if (errors.some((error) => error.includes('cannot patch order'))) return 'INVALID_SLOT';
  if (errors.some((error) => error.includes('isDeleted'))) return 'INVALID_FIELD';
  if (errors.some((error) => error.includes('full semantic value'))) return 'INVALID_FIELD';
  if (errors.some((error) => error.includes('invalid value'))) return 'INVALID_VALUE';
  if (errors.some((error) => error.includes('not supported'))) return 'UNSUPPORTED_COMMAND';
  return 'INVALID_VALUE';
}

function planPatchSlots(context: SyncRoomPlannerContext, command: PatchSlotsCommand): SyncRoomPlan {
  if (command.patches.length > MAX_PATCHES_PER_COMMAND) {
    throw new SyncRoomCommandError('TOO_LARGE');
  }

  const patchedByElement = new Map<
    string,
    { elementId: string; patches: SlotPatch[]; element: Element }
  >();

  for (const patch of command.patches) {
    const currentElement = patchedByElement.get(patch.elementId)?.element;
    const element = currentElement ?? getActiveElement(context, patch.elementId);
    validateSlotForElement(context, element, patch);
    const patchedElement = applySlotPatch(element, patch);
    const entry = patchedByElement.get(patch.elementId) ?? {
      elementId: patch.elementId,
      patches: [],
      element: patchedElement,
    };
    entry.patches.push(patch);
    entry.element = patchedElement;
    patchedByElement.set(patch.elementId, entry);
  }

  return {
    patched: [...patchedByElement.values()],
    slotClocks: command.patches.map((patch) => ({
      elementId: patch.elementId,
      slot: patch.slot,
      clock: context.serverClock,
    })),
  };
}

function planDeleteElements(
  context: SyncRoomPlannerContext,
  command: DeleteElementsCommand,
): SyncRoomPlan {
  if (command.elementIds.length > MAX_ELEMENTS_PER_DELETE) {
    throw new SyncRoomCommandError('TOO_LARGE');
  }

  const deleted = [...new Set(command.elementIds)];
  for (const elementId of deleted) {
    getActiveElement(context, elementId);
  }
  return { deleted };
}

function getActiveElement(context: SyncRoomPlannerContext, elementId: string): Element {
  const element = context.state.elements.get(elementId);
  if (element) return element;
  if (context.state.tombstoneElementIds.has(elementId)) {
    throw new SyncRoomCommandError('ELEMENT_DELETED');
  }
  throw new SyncRoomCommandError('ELEMENT_NOT_FOUND');
}
