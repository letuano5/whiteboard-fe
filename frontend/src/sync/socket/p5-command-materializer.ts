import type {
  Element,
  PatchSlotsCommand,
  ReorderElementsCommand,
  ReorderElementMove,
  SlotPatch,
  SyncCommand,
  SyncSlot,
} from '../../types/shared';
import { useElementsStore } from '../../store/elements.store';
import { SYNC_PROTOCOL_VERSION, SYNC_SCHEMA_VERSION } from '../../types/shared';
import { generateId } from '../../utils/id';
import { applySlotPatch, slotValueFromElement } from './p5-change-set';
import { getKnownSlotClock, getRoomEpochState } from './state';

const PATCHABLE_SLOTS: SyncSlot[] = [
  'transform.position',
  'transform.size',
  'transform.rotation',
  'style.strokeColor',
  'style.fillColor',
  'style.strokeWidth',
  'style.strokeStyle',
  'style.opacity',
  'style.roughness',
  'text.text',
  'text.fontSize',
  'text.fontFamily',
  'text.textAlign',
  'geometry.points',
  'geometry.startPoint',
  'geometry.endPoint',
  'binding.start',
  'binding.end',
  'asset.src',
  'embed.url',
  'grouping.groupId',
  'grouping.frameId',
  'state.locked',
];

type SyncCommandBase = Omit<PatchSlotsCommand, 'kind' | 'patches'>;

export function createElementCommand(
  roomId: string,
  element: Element,
  now: number,
  final: boolean,
): SyncCommand {
  return {
    ...baseCommand(roomId, now, final),
    kind: 'create-element',
    element,
    orderHint: { baseOrderClock: getKnownSlotClock(element.id, 'order') },
  };
}

export function createDeleteCommand(
  roomId: string,
  elementIds: string[],
  now: number,
): SyncCommand {
  return {
    ...baseCommand(roomId, now, true),
    kind: 'delete-elements',
    elementIds,
  };
}

export function createPatchCommand(
  roomId: string,
  patches: SlotPatch[],
  now: number,
  final: boolean,
): PatchSlotsCommand {
  return {
    ...baseCommand(roomId, now, final),
    kind: 'patch-slots',
    patches,
  };
}

export function createReorderCommand(
  roomId: string,
  beforeElements: readonly Element[],
  afterElements: readonly Element[],
  now: number,
): ReorderElementsCommand | null {
  const changed = afterElements.filter((after) => {
    const before = beforeElements.find((element) => element.id === after.id);
    return before !== undefined && before.zIndex !== after.zIndex;
  });
  if (changed.length === 0) return null;

  const activeAfter = getActiveAfterOrder(afterElements);
  const moves = changed
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((element): ReorderElementMove => {
      const index = activeAfter.findIndex((candidate) => candidate.id === element.id);
      const previous = index > 0 ? activeAfter[index - 1] : undefined;
      const next = index >= 0 ? activeAfter[index + 1] : undefined;
      return {
        elementId: element.id,
        ...(previous ? { afterElementId: previous.id } : {}),
        ...(!previous && next ? { beforeElementId: next.id } : {}),
        baseOrderClock: getKnownSlotClock(element.id, 'order'),
      };
    });

  return {
    ...baseCommand(roomId, now, true),
    kind: 'reorder-elements',
    moves,
  };
}

export function diffElementSlots(before: Element, after: Element): SlotPatch[] {
  return PATCHABLE_SLOTS.flatMap((slot) => {
    const previousValue = slotValueFromElement(slot, before);
    const nextValue = slotValueFromElement(slot, after);
    if (JSON.stringify(previousValue) === JSON.stringify(nextValue)) return [];
    return [
      {
        elementId: after.id,
        slot,
        baseClock: getKnownSlotClock(after.id, slot),
        changes: nextValue,
        inverseChanges: previousValue,
      },
    ];
  });
}

export function commandElementIds(command: SyncCommand): string[] {
  switch (command.kind) {
    case 'create-element':
      return [command.element.id];
    case 'patch-slots':
      return [...new Set(command.patches.map((patch) => patch.elementId))];
    case 'delete-elements':
      return command.elementIds;
    case 'update-arrow-binding':
      return [command.arrowId];
    case 'replace-document':
      return command.elements.map((element) => element.id);
    case 'reorder-elements':
      return command.moves.map((move) => move.elementId);
  }
}

export function applyOptimisticCommand(elements: Element[], command: SyncCommand): Element[] {
  switch (command.kind) {
    case 'create-element':
      return elements.some((element) => element.id === command.element.id)
        ? elements
        : [...elements, command.element];
    case 'patch-slots':
      return elements.map((element) => {
        const patches = command.patches.filter((patch) => patch.elementId === element.id);
        return patches.reduce(applySlotPatch, element);
      });
    case 'delete-elements': {
      const deleted = new Set(command.elementIds);
      return elements.filter((element) => !deleted.has(element.id));
    }
    case 'replace-document':
      return command.elements;
    case 'reorder-elements':
      return applyOptimisticReorder(elements, command);
    case 'update-arrow-binding':
      return elements;
  }
}

export function cloneElement(element: Element): Element {
  return { ...element, props: { ...element.props } };
}

function baseCommand(roomId: string, now: number, final: boolean): SyncCommandBase {
  return {
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId,
    requestId: generateId(),
    clientClock: now,
    baseRoomEpoch: getRoomEpochState(),
    persistence: final
      ? { durability: 'durable', resendable: true, storeProcessedRequest: true }
      : {
          durability: 'relaxed',
          transient: true,
          resendable: false,
          storeProcessedRequest: false,
        },
  };
}

function getActiveAfterOrder(afterElements: readonly Element[]): Element[] {
  const changedIds = new Set(afterElements.map((element) => element.id));
  const current = useElementsStore.getState().elements;
  const merged = new Map(current.map((element) => [element.id, element]));
  for (const element of afterElements) {
    merged.set(element.id, element);
  }
  if (merged.size === 0) {
    for (const element of afterElements) {
      merged.set(element.id, element);
    }
  }

  const active = [...merged.values()].filter((element) => !element.isDeleted);
  const activeIds = new Set(active.map((element) => element.id));
  if (![...changedIds].every((id) => activeIds.has(id))) {
    return afterElements.filter((element) => !element.isDeleted).sort(compareOrder);
  }
  return active.sort(compareOrder);
}

function applyOptimisticReorder(elements: Element[], command: ReorderElementsCommand): Element[] {
  const ordered = [...elements].sort(compareOrder);
  for (const move of command.moves) {
    const moving = ordered.find((element) => element.id === move.elementId);
    if (!moving) continue;
    const withoutMoving = ordered.filter((element) => element.id !== move.elementId);
    const insertIndex = insertionIndex(withoutMoving, move);
    withoutMoving.splice(insertIndex, 0, moving);
    ordered.splice(0, ordered.length, ...withoutMoving);
  }

  const byId = new Map(
    ordered.map((element, index) => [element.id, { ...element, zIndex: index + 1 }]),
  );
  return elements.map((element) => byId.get(element.id) ?? element);
}

function insertionIndex(elements: Element[], move: ReorderElementMove): number {
  if (move.afterElementId) {
    const afterIndex = elements.findIndex((element) => element.id === move.afterElementId);
    if (afterIndex !== -1) return afterIndex + 1;
  }
  if (move.beforeElementId) {
    const beforeIndex = elements.findIndex((element) => element.id === move.beforeElementId);
    if (beforeIndex !== -1) return beforeIndex;
  }
  return elements.length;
}

function compareOrder(a: Element, b: Element): number {
  return a.zIndex - b.zIndex || a.id.localeCompare(b.id);
}
