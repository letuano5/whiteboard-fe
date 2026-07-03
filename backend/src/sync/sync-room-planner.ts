import {
  materializeCreatedElement,
  validateSyncCommand,
  type ArrowEndpointBinding,
  type DeleteElementsCommand,
  type Element,
  type PatchSlotsCommand,
  type PointTuple,
  type ReorderElementMove,
  type ReorderElementsCommand,
  type SlotPatch,
  type SyncSlot,
  type UpdateArrowBindingCommand,
} from '@vdt/shared';
import { SyncRoomCommandError, type SyncRoomErrorCode } from './sync-room-errors.js';
import {
  MAX_ELEMENTS_PER_DELETE,
  MAX_PATCHES_PER_COMMAND,
  MAX_REPAIRED_ARROWS_PER_COMMAND,
} from './sync-room-limits.js';
import { applySlotPatch, validateSlotForElement } from './sync-room-slot-patches.js';
import type { SyncRoomPlan, SyncRoomPlannerContext } from './sync-room.js';

const INITIAL_SYNC_SLOTS: SyncSlot[] = [
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
  'geometry.route',
  'geometry.startPoint',
  'geometry.endPoint',
  'binding.start',
  'binding.end',
  'order',
  'asset.src',
  'embed.url',
  'grouping.groupId',
  'grouping.frameId',
  'state.locked',
];

export function defaultSyncRoomPlanner(context: SyncRoomPlannerContext): SyncRoomPlan {
  validateCommandBoundary(context);

  switch (context.command.kind) {
    case 'create-element': {
      const materialized = materializeCreatedElement(context.command);
      return {
        created: [materialized.element],
        normalizedOrder: [materialized.normalizedOrder],
        slotClocks: createInitialSlotClocks(materialized.element.id, context.serverClock),
      };
    }
    case 'patch-slots':
      return planPatchSlots(context, context.command);
    case 'delete-elements':
      return planDeleteElements(context, context.command);
    case 'restore-elements': {
      const restored = context.command.elements.map((element) => ({
        ...element,
        isDeleted: false,
      }));
      return {
        reason: 'restore',
        created: restored,
        slotClocks: restored.flatMap((element) =>
          createInitialSlotClocks(element.id, context.serverClock),
        ),
        normalizedOrder: restored.map((element) => ({
          elementId: element.id,
          zIndex: element.zIndex,
        })),
      };
    }
    case 'reorder-elements':
      return planReorderElements(context, context.command);
    case 'update-arrow-binding':
      return planUpdateArrowBinding(context, context.command);
    case 'replace-document': {
      const created = context.command.elements.map((element) => ({ ...element, isDeleted: false }));
      const replacementIds = new Set(created.map((element) => element.id));
      return {
        reason: 'replace_document',
        created,
        deleted: [...context.state.elements.keys()].filter(
          (elementId) => !replacementIds.has(elementId),
        ),
        slotClocks: created.flatMap((element) =>
          createInitialSlotClocks(element.id, context.serverClock),
        ),
        roomEpoch: context.state.roomEpoch + 1,
        normalizedOrder: created.map((element) => ({
          elementId: element.id,
          zIndex: element.zIndex,
        })),
      };
    }
    default:
      throw new SyncRoomCommandError(
        'UNSUPPORTED_COMMAND',
        'Command planning is owned by later P5 phases.',
      );
  }
}

function createInitialSlotClocks(elementId: string, clock: number) {
  return INITIAL_SYNC_SLOTS.map((slot) => ({ elementId, slot, clock }));
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
  if (errors.some((error) => error.includes('is not tombstoned'))) return 'ELEMENT_NOT_FOUND';
  if (errors.some((error) => error.includes('duplicate element slot'))) return 'INVALID_SLOT';
  if (errors.some((error) => error.includes('SlotPatch.slot is invalid'))) return 'INVALID_SLOT';
  if (errors.some((error) => error.includes('cannot patch order'))) return 'INVALID_SLOT';
  if (errors.some((error) => error.includes('isDeleted'))) return 'INVALID_FIELD';
  if (errors.some((error) => error.includes('full semantic value'))) return 'INVALID_FIELD';
  if (errors.some((error) => error.includes('invalid value'))) return 'INVALID_VALUE';
  if (errors.some((error) => error.includes('not supported'))) return 'UNSUPPORTED_COMMAND';
  return 'INVALID_VALUE';
}

function planReorderElements(
  context: SyncRoomPlannerContext,
  command: ReorderElementsCommand,
): SyncRoomPlan {
  const order = [...context.state.elements.values()].sort(compareOrder);
  for (const move of command.moves) {
    getActiveElement(context, move.elementId);
    if (move.afterElementId) getActiveElement(context, move.afterElementId);
    if (move.beforeElementId) getActiveElement(context, move.beforeElementId);
    const currentOrderClock = currentSlotClock(context, move.elementId, 'order');
    if (move.baseOrderClock !== undefined && move.baseOrderClock > currentOrderClock) {
      throw new SyncRoomCommandError('STALE_CLIENT_STATE');
    }
    applyOrderMove(order, move);
  }

  const patched = order.flatMap((element, index) => {
    const zIndex = index + 1;
    if (element.zIndex === zIndex) return [];
    const patch: SlotPatch<'order'> = {
      elementId: element.id,
      slot: 'order',
      baseClock: currentSlotClock(context, element.id, 'order'),
      changes: { zIndex },
      inverseChanges: { zIndex: element.zIndex },
    };
    return [{ elementId: element.id, patches: [patch], element: { ...element, zIndex } }];
  });

  return {
    reason: 'reorder',
    patched,
    slotClocks: patched.map((entry) => ({
      elementId: entry.elementId,
      slot: 'order',
      clock: context.serverClock,
    })),
    normalizedOrder: patched.map((entry) => ({
      elementId: entry.elementId,
      zIndex: entry.element.zIndex,
    })),
  };
}

function applyOrderMove(order: Element[], move: ReorderElementMove): void {
  const moving = order.find((element) => element.id === move.elementId);
  if (!moving) return;

  const withoutMoving = order.filter((element) => element.id !== move.elementId);
  let insertIndex = withoutMoving.length;
  if (move.afterElementId) {
    const afterIndex = withoutMoving.findIndex((element) => element.id === move.afterElementId);
    if (afterIndex !== -1) insertIndex = afterIndex + 1;
  } else if (move.beforeElementId) {
    const beforeIndex = withoutMoving.findIndex((element) => element.id === move.beforeElementId);
    if (beforeIndex !== -1) insertIndex = beforeIndex;
  }

  withoutMoving.splice(insertIndex, 0, moving);
  order.splice(0, order.length, ...withoutMoving);
}

function compareOrder(a: Element, b: Element): number {
  return a.zIndex - b.zIndex || a.id.localeCompare(b.id);
}

function planPatchSlots(context: SyncRoomPlannerContext, command: PatchSlotsCommand): SyncRoomPlan {
  if (command.patches.length > MAX_PATCHES_PER_COMMAND) {
    throw new SyncRoomCommandError('TOO_LARGE');
  }

  const patchedByElement = new Map<
    string,
    { elementId: string; patches: SlotPatch[]; element: Element }
  >();
  let hasLwwConflict = false;

  for (const patch of command.patches) {
    const currentElement = patchedByElement.get(patch.elementId)?.element;
    const element = currentElement ?? getActiveElement(context, patch.elementId);
    const currentClock = context.state.slotClocks.get(`${patch.elementId}:${patch.slot}`) ?? 0;
    if (patch.baseClock < currentClock) {
      hasLwwConflict = true;
    }
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

  const patched = [...patchedByElement.values()];
  const touchedTargets = new Map<string, Element>();
  for (const patch of command.patches) {
    if (isTargetRepairTrigger(patch.slot)) {
      const patchedElement = patchedByElement.get(patch.elementId)?.element;
      if (patchedElement) {
        touchedTargets.set(patch.elementId, patchedElement);
      }
    }
  }
  const repairs = createBoundArrowRepairs({
    context,
    targetElements: touchedTargets,
    existingPatched: patchedByElement,
  });

  return {
    reason: hasLwwConflict ? 'patch_lww_conflict' : 'patch_clean',
    patched: [...patched, ...(repairs.patched ?? [])],
    slotClocks: [
      ...command.patches.map((patch) => ({
        elementId: patch.elementId,
        slot: patch.slot,
        clock: context.serverClock,
      })),
      ...(repairs.slotClocks ?? []),
    ],
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

  const repairs = createDeleteBindingRepairs(context, new Set(deleted));
  return {
    reason: 'delete',
    deleted,
    patched: repairs.patched,
    slotClocks: repairs.slotClocks,
  };
}

function planUpdateArrowBinding(
  context: SyncRoomPlannerContext,
  command: UpdateArrowBindingCommand,
): SyncRoomPlan {
  const arrow = getActiveElement(context, command.arrowId);
  if (arrow.type !== 'arrow') {
    throw new SyncRoomCommandError('INVALID_SLOT_FOR_ELEMENT_TYPE');
  }
  if (command.binding) {
    getBindingTarget(context, command.binding.elementId);
  }

  const bindingSlot = command.terminal === 'start' ? 'binding.start' : 'binding.end';
  const currentBindingClock = currentSlotClock(context, command.arrowId, bindingSlot);
  const currentGeometryClock = Math.max(
    currentSlotClock(context, command.arrowId, 'geometry.startPoint'),
    currentSlotClock(context, command.arrowId, 'geometry.endPoint'),
  );
  const hasLwwConflict =
    command.baseBindingClock < currentBindingClock ||
    command.baseGeometryClock < currentGeometryClock;

  const patched = repairArrow({
    context,
    arrow,
    startBinding: command.terminal === 'start' ? command.binding : arrow.props.startBinding,
    endBinding: command.terminal === 'end' ? command.binding : arrow.props.endBinding,
    forceBindingSlots: [command.terminal === 'start' ? 'binding.start' : 'binding.end'],
  });

  return {
    reason: hasLwwConflict ? 'patch_lww_conflict' : 'binding_update',
    patched: [patched],
    slotClocks: toSlotClocks(patched.patches, context.serverClock),
  };
}

function getActiveElement(context: SyncRoomPlannerContext, elementId: string): Element {
  const element = context.state.elements.get(elementId);
  if (element) return element;
  if (context.state.tombstoneElementIds.has(elementId)) {
    throw new SyncRoomCommandError('ELEMENT_DELETED');
  }
  throw new SyncRoomCommandError('ELEMENT_NOT_FOUND');
}

function getBindingTarget(context: SyncRoomPlannerContext, elementId: string): Element {
  const target = context.state.elements.get(elementId);
  if (!target || target.isDeleted || context.state.tombstoneElementIds.has(elementId)) {
    throw new SyncRoomCommandError('INVALID_BINDING_TARGET');
  }
  if (target.type === 'arrow' || target.type === 'line') {
    throw new SyncRoomCommandError('INVALID_BINDING_TARGET');
  }
  return target;
}

function isTargetRepairTrigger(slot: SyncSlot): boolean {
  return (
    slot === 'transform.position' ||
    slot === 'transform.size' ||
    slot === 'transform.rotation' ||
    slot === 'geometry.points' ||
    slot === 'geometry.startPoint' ||
    slot === 'geometry.endPoint'
  );
}

function createDeleteBindingRepairs(
  context: SyncRoomPlannerContext,
  deletedIds: ReadonlySet<string>,
): Pick<SyncRoomPlan, 'patched' | 'slotClocks'> {
  const patched: NonNullable<SyncRoomPlan['patched']> = [];
  for (const arrow of context.state.elements.values()) {
    if (arrow.type !== 'arrow' || deletedIds.has(arrow.id)) continue;
    const start = readBinding(arrow.props.startBinding);
    const end = readBinding(arrow.props.endBinding);
    const clearsStart = start !== null && deletedIds.has(start.elementId);
    const clearsEnd = end !== null && deletedIds.has(end.elementId);
    if (!clearsStart && !clearsEnd) continue;

    patched.push(
      repairArrow({
        context,
        arrow,
        startBinding: clearsStart ? null : arrow.props.startBinding,
        endBinding: clearsEnd ? null : arrow.props.endBinding,
        forceBindingSlots: [
          ...(clearsStart ? (['binding.start'] as const) : []),
          ...(clearsEnd ? (['binding.end'] as const) : []),
        ],
      }),
    );
  }

  assertRepairCountWithinLimit(patched);
  return { patched, slotClocks: toSlotClocksFromPatched(patched, context.serverClock) };
}

function createBoundArrowRepairs({
  context,
  targetElements,
  existingPatched,
}: {
  context: SyncRoomPlannerContext;
  targetElements: ReadonlyMap<string, Element>;
  existingPatched: ReadonlyMap<
    string,
    { elementId: string; patches: SlotPatch[]; element: Element }
  >;
}): Pick<SyncRoomPlan, 'patched' | 'slotClocks'> {
  if (targetElements.size === 0) return { patched: [], slotClocks: [] };

  const patched: NonNullable<SyncRoomPlan['patched']> = [];
  for (const arrow of context.state.elements.values()) {
    if (arrow.type !== 'arrow') continue;
    const existingEntry = existingPatched.get(arrow.id);
    if (existingEntry && hasGeometryOrBindingPatch(existingEntry.patches)) continue;
    const startTargetId = readBinding(arrow.props.startBinding)?.elementId;
    const endTargetId = readBinding(arrow.props.endBinding)?.elementId;
    if (
      (startTargetId === undefined || !targetElements.has(startTargetId)) &&
      (endTargetId === undefined || !targetElements.has(endTargetId))
    ) {
      continue;
    }
    patched.push(repairArrow({ context, arrow, overrideTargets: targetElements }));
  }

  assertRepairCountWithinLimit(patched);
  return { patched, slotClocks: toSlotClocksFromPatched(patched, context.serverClock) };
}

function repairArrow({
  context,
  arrow,
  startBinding = arrow.props.startBinding,
  endBinding = arrow.props.endBinding,
  forceBindingSlots = [],
  overrideTargets = new Map(),
}: {
  context: SyncRoomPlannerContext;
  arrow: Element;
  startBinding?: Element['props']['startBinding'];
  endBinding?: Element['props']['endBinding'];
  forceBindingSlots?: readonly ('binding.start' | 'binding.end')[];
  overrideTargets?: ReadonlyMap<string, Element>;
}): { elementId: string; patches: SlotPatch[]; element: Element } {
  const originalPoints = ensureArrowPoints(arrow);
  const nextStartPoint =
    pointForBinding(context, startBinding, overrideTargets) ?? originalPoints[0];
  const nextEndPoint =
    pointForBinding(context, endBinding, overrideTargets) ??
    originalPoints[originalPoints.length - 1];
  const nextPoints: PointTuple[] = [clonePoint(nextStartPoint), clonePoint(nextEndPoint)];

  const patches: SlotPatch[] = [];
  if (forceBindingSlots.includes('binding.start')) {
    patches.push({
      elementId: arrow.id,
      slot: 'binding.start',
      baseClock: currentSlotClock(context, arrow.id, 'binding.start'),
      changes: { binding: normalizeBinding(startBinding) },
    });
  }
  if (forceBindingSlots.includes('binding.end')) {
    patches.push({
      elementId: arrow.id,
      slot: 'binding.end',
      baseClock: currentSlotClock(context, arrow.id, 'binding.end'),
      changes: { binding: normalizeBinding(endBinding) },
    });
  }
  patches.push(
    {
      elementId: arrow.id,
      slot: 'geometry.startPoint',
      baseClock: currentSlotClock(context, arrow.id, 'geometry.startPoint'),
      changes: { startPoint: nextStartPoint },
    },
    {
      elementId: arrow.id,
      slot: 'geometry.endPoint',
      baseClock: currentSlotClock(context, arrow.id, 'geometry.endPoint'),
      changes: { endPoint: nextEndPoint },
    },
    {
      elementId: arrow.id,
      slot: 'geometry.route',
      baseClock: currentSlotClock(context, arrow.id, 'geometry.route'),
      changes: { route: null },
    },
  );

  const element = patches.reduce(applySlotPatch, arrow);
  return {
    elementId: arrow.id,
    patches,
    element: { ...element, ...normalizeLinearBounds(nextPoints) },
  };
}

function pointForBinding(
  context: SyncRoomPlannerContext,
  binding: Element['props']['startBinding'],
  overrideTargets: ReadonlyMap<string, Element>,
): PointTuple | null {
  const parsed = readBinding(binding);
  if (!parsed) return null;
  const target =
    overrideTargets.get(parsed.elementId) ?? getBindingTarget(context, parsed.elementId);
  return computeAnchorPoint(target, parsed.anchorRatio);
}

function readBinding(
  binding: Element['props']['startBinding'],
): { elementId: string; anchorRatio: { x: number; y: number } } | null {
  if (!binding) return null;
  if (typeof binding === 'object') {
    return { elementId: binding.elementId, anchorRatio: binding.anchorRatio };
  }
  const index = binding.lastIndexOf(':');
  if (index === -1) return null;
  const elementId = binding.slice(0, index);
  const pointKey = binding.slice(index + 1);
  const anchorRatio = pointKeyToAnchorRatio(pointKey);
  return elementId && anchorRatio ? { elementId, anchorRatio } : null;
}

function normalizeBinding(binding: Element['props']['startBinding']): ArrowEndpointBinding | null {
  const parsed = readBinding(binding);
  return parsed ? { elementId: parsed.elementId, anchorRatio: parsed.anchorRatio } : null;
}

function pointKeyToAnchorRatio(pointKey: string): { x: number; y: number } | null {
  switch (pointKey) {
    case 'center':
      return { x: 0.5, y: 0.5 };
    case 'top':
      return { x: 0.5, y: 0 };
    case 'right':
      return { x: 1, y: 0.5 };
    case 'bottom':
      return { x: 0.5, y: 1 };
    case 'left':
      return { x: 0, y: 0.5 };
    default:
      return null;
  }
}

function computeAnchorPoint(target: Element, anchorRatio: { x: number; y: number }): PointTuple {
  const center: PointTuple = [target.x + target.width / 2, target.y + target.height / 2];
  const point: PointTuple = [
    target.x + target.width * anchorRatio.x,
    target.y + target.height * anchorRatio.y,
  ];
  if (target.angle === 0) return point;
  const cos = Math.cos(target.angle);
  const sin = Math.sin(target.angle);
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  return [center[0] + dx * cos - dy * sin, center[1] + dx * sin + dy * cos];
}

function ensureArrowPoints(arrow: Element): [PointTuple, PointTuple] {
  const points = arrow.props.points ?? [
    [arrow.x, arrow.y],
    [arrow.x + arrow.width, arrow.y + arrow.height],
  ];
  return [
    clonePoint(points[0] ?? [arrow.x, arrow.y]),
    clonePoint(points.at(-1) ?? [arrow.x, arrow.y]),
  ];
}

function normalizeLinearBounds(
  points: readonly PointTuple[],
): Pick<Element, 'x' | 'y' | 'width' | 'height'> {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function clonePoint(point: PointTuple): PointTuple {
  return [point[0], point[1]];
}

function currentSlotClock(
  context: SyncRoomPlannerContext,
  elementId: string,
  slot: SyncSlot,
): number {
  return context.state.slotClocks.get(`${elementId}:${slot}`) ?? 0;
}

function toSlotClocksFromPatched(patched: NonNullable<SyncRoomPlan['patched']>, clock: number) {
  return patched.flatMap((entry) => toSlotClocks(entry.patches, clock));
}

function toSlotClocks(patches: readonly SlotPatch[], clock: number) {
  return patches.map((patch) => ({ elementId: patch.elementId, slot: patch.slot, clock }));
}

function hasGeometryOrBindingPatch(patches: readonly SlotPatch[]): boolean {
  return patches.some(
    (p) =>
      p.slot.startsWith('geometry.') ||
      p.slot.startsWith('transform.') ||
      p.slot === 'binding.start' ||
      p.slot === 'binding.end',
  );
}

function assertRepairCountWithinLimit(patched: NonNullable<SyncRoomPlan['patched']>): void {
  if (patched.length > MAX_REPAIRED_ARROWS_PER_COMMAND) {
    throw new SyncRoomCommandError('TOO_LARGE');
  }
}
