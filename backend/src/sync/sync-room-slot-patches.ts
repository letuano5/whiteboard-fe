import type { Element, PointTuple, SlotPatch, SlotValue } from '@vdt/shared';
import { SyncRoomCommandError } from './sync-room-errors.js';
import { MAX_POINTS_PER_STROKE } from './sync-room-limits.js';
import type { SyncRoomPlannerContext } from './sync-room.js';

const LINEAR_ELEMENT_TYPES = new Set<Element['type']>(['line', 'arrow', 'freehand', 'highlighter']);

export function validateSlotForElement(
  context: SyncRoomPlannerContext,
  element: Element,
  patch: SlotPatch,
): void {
  const isLinear = LINEAR_ELEMENT_TYPES.has(element.type);
  if (isLinear && patch.slot.startsWith('transform.')) {
    throw new SyncRoomCommandError('INVALID_SLOT_FOR_ELEMENT_TYPE');
  }
  if (!isLinear && patch.slot.startsWith('geometry.')) {
    throw new SyncRoomCommandError('INVALID_SLOT_FOR_ELEMENT_TYPE');
  }
  if (
    element.type === 'arrow' &&
    ((patch.slot === 'geometry.startPoint' && element.props.startBinding) ||
      (patch.slot === 'geometry.endPoint' && element.props.endBinding))
  ) {
    throw new SyncRoomCommandError('INVALID_SLOT_FOR_ELEMENT_TYPE');
  }
  validateReferencePatch(context, element.id, patch);
  validateLinearGeometryPatch(element, patch);
}

export function applySlotPatch(element: Element, patch: SlotPatch): Element {
  const next: Element = { ...element, props: { ...element.props } };

  switch (patch.slot) {
    case 'transform.position': {
      const changes = patch.changes as SlotValue<'transform.position'>;
      return { ...next, x: changes.x, y: changes.y };
    }
    case 'transform.size': {
      const changes = patch.changes as SlotValue<'transform.size'>;
      return { ...next, width: changes.width, height: changes.height };
    }
    case 'transform.rotation': {
      const changes = patch.changes as SlotValue<'transform.rotation'>;
      return { ...next, angle: changes.angle };
    }
    case 'style.strokeColor': {
      const changes = patch.changes as SlotValue<'style.strokeColor'>;
      next.props.strokeColor = changes.strokeColor;
      return next;
    }
    case 'style.fillColor': {
      const changes = patch.changes as SlotValue<'style.fillColor'>;
      next.props.fillColor = changes.fillColor;
      return next;
    }
    case 'style.strokeWidth': {
      const changes = patch.changes as SlotValue<'style.strokeWidth'>;
      next.props.strokeWidth = changes.strokeWidth;
      return next;
    }
    case 'style.strokeStyle': {
      const changes = patch.changes as SlotValue<'style.strokeStyle'>;
      next.props.strokeStyle = changes.strokeStyle;
      return next;
    }
    case 'style.opacity': {
      const changes = patch.changes as SlotValue<'style.opacity'>;
      next.props.opacity = changes.opacity;
      return next;
    }
    case 'style.roughness': {
      const changes = patch.changes as SlotValue<'style.roughness'>;
      setOptionalProp(next.props, 'roughness', changes.roughness);
      return next;
    }
    case 'text.text': {
      const changes = patch.changes as SlotValue<'text.text'>;
      setOptionalProp(next.props, 'text', changes.text);
      return next;
    }
    case 'text.fontSize': {
      const changes = patch.changes as SlotValue<'text.fontSize'>;
      setOptionalProp(next.props, 'fontSize', changes.fontSize);
      return next;
    }
    case 'text.fontFamily': {
      const changes = patch.changes as SlotValue<'text.fontFamily'>;
      setOptionalProp(next.props, 'fontFamily', changes.fontFamily);
      return next;
    }
    case 'text.textAlign': {
      const changes = patch.changes as SlotValue<'text.textAlign'>;
      setOptionalProp(next.props, 'textAlign', changes.textAlign);
      return next;
    }
    case 'geometry.points': {
      const changes = patch.changes as SlotValue<'geometry.points'>;
      return applyGeometryPoints(next, changes.points);
    }
    case 'geometry.startPoint': {
      const changes = patch.changes as SlotValue<'geometry.startPoint'>;
      return applyEndpointPoint(next, 0, changes.startPoint);
    }
    case 'geometry.endPoint': {
      const changes = patch.changes as SlotValue<'geometry.endPoint'>;
      return applyEndpointPoint(next, -1, changes.endPoint);
    }
    case 'geometry.route':
      return next;
    case 'binding.start': {
      const changes = patch.changes as SlotValue<'binding.start'>;
      next.props.startBinding = changes.binding?.elementId ?? null;
      return next;
    }
    case 'binding.end': {
      const changes = patch.changes as SlotValue<'binding.end'>;
      next.props.endBinding = changes.binding?.elementId ?? null;
      return next;
    }
    case 'asset.src': {
      const changes = patch.changes as SlotValue<'asset.src'>;
      setOptionalProp(next.props, 'src', changes.src);
      return next;
    }
    case 'embed.url': {
      const changes = patch.changes as SlotValue<'embed.url'>;
      setOptionalProp(next.props, 'url', changes.url);
      return next;
    }
    case 'grouping.groupId': {
      const changes = patch.changes as SlotValue<'grouping.groupId'>;
      return { ...next, groupId: changes.groupId };
    }
    case 'grouping.frameId': {
      const changes = patch.changes as SlotValue<'grouping.frameId'>;
      return { ...next, frameId: changes.frameId };
    }
    case 'state.locked': {
      const changes = patch.changes as SlotValue<'state.locked'>;
      return { ...next, locked: changes.locked };
    }
    case 'order':
      throw new SyncRoomCommandError('INVALID_SLOT');
  }
}

function validateReferencePatch(
  context: SyncRoomPlannerContext,
  elementId: string,
  patch: SlotPatch,
): void {
  switch (patch.slot) {
    case 'asset.src': {
      const changes = patch.changes as SlotValue<'asset.src'>;
      const src = changes.src;
      if (src === null) return;
      if (context.referenceValidator?.canUseAssetSrc?.(src, context.actorContext) === true) return;
      throw new SyncRoomCommandError('INVALID_VALUE');
    }
    case 'grouping.groupId': {
      const changes = patch.changes as SlotValue<'grouping.groupId'>;
      validateElementReference(context, elementId, changes.groupId, 'group');
      return;
    }
    case 'grouping.frameId': {
      const changes = patch.changes as SlotValue<'grouping.frameId'>;
      validateElementReference(context, elementId, changes.frameId, 'frame');
      return;
    }
    case 'binding.start':
    case 'binding.end': {
      const changes = patch.changes as SlotValue<'binding.start'> | SlotValue<'binding.end'>;
      validateElementReference(context, elementId, changes.binding?.elementId ?? null, 'any');
      return;
    }
    default:
      return;
  }
}

function validateElementReference(
  context: SyncRoomPlannerContext,
  elementId: string,
  targetId: string | null,
  targetType: 'any' | 'group' | 'frame',
): void {
  if (targetId === null) return;
  const target = context.state.elements.get(targetId);
  const validFrame = targetType !== 'frame' || target?.type === 'frame';
  if (!target || target.id === elementId || target.isDeleted || !validFrame) {
    throw new SyncRoomCommandError('INVALID_BINDING_TARGET');
  }
}

function validateLinearGeometryPatch(element: Element, patch: SlotPatch): void {
  if (patch.slot !== 'geometry.points') return;
  const changes = patch.changes as SlotValue<'geometry.points'>;
  const points = changes.points;
  if (
    (element.type === 'freehand' || element.type === 'highlighter') &&
    points.length > MAX_POINTS_PER_STROKE
  ) {
    throw new SyncRoomCommandError('TOO_LARGE');
  }
  if ((element.type === 'line' || element.type === 'arrow') && points.length < 2) {
    throw new SyncRoomCommandError('INVALID_VALUE');
  }
}

function setOptionalProp<K extends keyof Element['props']>(
  props: Element['props'],
  key: K,
  value: Element['props'][K] | null,
): void {
  if (value === null) {
    delete props[key];
    return;
  }
  props[key] = value;
}

function applyEndpointPoint(element: Element, index: 0 | -1, point: PointTuple | null): Element {
  if (point === null) return element;
  const points = [...(element.props.points ?? [])];
  if (index === 0) {
    points[0] = point;
  } else {
    points[Math.max(points.length - 1, 0)] = point;
  }
  return applyGeometryPoints(element, points);
}

function applyGeometryPoints(element: Element, points: PointTuple[]): Element {
  const next = { ...element, props: { ...element.props, points: points.map(clonePoint) } };
  return { ...next, ...normalizeLinearBounds(points) };
}

function clonePoint(point: PointTuple): PointTuple {
  return [point[0], point[1]];
}

function normalizeLinearBounds(
  points: readonly PointTuple[],
): Pick<Element, 'x' | 'y' | 'width' | 'height'> {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

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
