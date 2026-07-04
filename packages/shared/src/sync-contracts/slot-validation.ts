import {
  isArrowEndpointBinding,
  isFiniteNumber,
  isPoint,
  isPointList,
  isRecord,
  isSyncSlot,
} from './guards';
import type { SyncClock, SyncSlot } from './types';

const SLOT_VALUE_KEYS = {
  'transform.position': ['x', 'y'],
  'transform.size': ['width', 'height'],
  'transform.rotation': ['angle'],
  'style.strokeColor': ['strokeColor'],
  'style.fillColor': ['fillColor'],
  'style.strokeWidth': ['strokeWidth'],
  'style.strokeStyle': ['strokeStyle'],
  'style.opacity': ['opacity'],
  'style.roughness': ['roughness'],
  'text.text': ['text'],
  'text.fontSize': ['fontSize'],
  'text.fontFamily': ['fontFamily'],
  'text.textAlign': ['textAlign'],
  'geometry.points': ['points'],
  'geometry.route': ['route'],
  'geometry.startPoint': ['startPoint'],
  'geometry.endPoint': ['endPoint'],
  'binding.start': ['binding'],
  'binding.end': ['binding'],
  order: ['zIndex'],
  'asset.src': ['src'],
  'embed.url': ['url'],
  'grouping.groupId': ['groupId'],
  'grouping.frameId': ['frameId'],
  'state.locked': ['locked'],
} as const satisfies Record<SyncSlot, readonly string[]>;

export function validateSlotPatch(
  value: unknown,
  errors: string[],
  getCurrentSlotClock?: (elementId: string, slot: SyncSlot) => SyncClock,
): void {
  if (!isRecord(value)) {
    errors.push('SlotPatch must be an object.');
    return;
  }
  if (typeof value.elementId !== 'string' || value.elementId.length === 0) {
    errors.push('SlotPatch.elementId is required.');
  }
  if (!isFiniteNumber(value.baseClock)) {
    errors.push('SlotPatch.baseClock is required.');
  } else if (value.baseClock < 0) {
    errors.push('SlotPatch.baseClock must be non-negative.');
  }
  if (!isSyncSlot(value.slot)) {
    errors.push('SlotPatch.slot is invalid.');
    return;
  }
  if (value.slot === 'order') {
    errors.push('SlotPatch cannot patch order; use ReorderElementsCommand.');
  }
  if (typeof value.elementId === 'string' && isFiniteNumber(value.baseClock)) {
    const currentClock = getCurrentSlotClock?.(value.elementId, value.slot) ?? value.baseClock;
    if (value.baseClock > currentClock) {
      errors.push('STALE_CLIENT_STATE');
    }
  }
  if ('batchId' in value || 'requestId' in value || 'ack' in value) {
    errors.push('SlotPatch must not carry patch-level request or ack fields.');
  }
  validateSlotValue(value.slot, value.changes, 'SlotPatch.changes', errors);
  if (isRecord(value.changes) && 'isDeleted' in value.changes) {
    errors.push('SlotPatch cannot patch isDeleted; use DeleteElementsCommand.');
  }
  if (value.inverseChanges !== undefined) {
    validateSlotValue(value.slot, value.inverseChanges, 'SlotPatch.inverseChanges', errors);
  }
}

function validateSlotValue(slot: SyncSlot, value: unknown, label: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  const expectedKeys = SLOT_VALUE_KEYS[slot];
  const keys = Object.keys(value);
  if (keys.length !== expectedKeys.length || expectedKeys.some((key) => !keys.includes(key))) {
    errors.push(`${label} must contain the full semantic value for ${slot}.`);
    return;
  }
  if (!hasValidSlotValue(slot, value)) {
    errors.push(`${label} has invalid value for ${slot}.`);
  }
}

function hasValidSlotValue(slot: SyncSlot, value: Record<string, unknown>): boolean {
  switch (slot) {
    case 'transform.position':
      return isFiniteNumber(value.x) && isFiniteNumber(value.y);
    case 'transform.size':
      return isNonNegativeNumber(value.width) && isNonNegativeNumber(value.height);
    case 'transform.rotation':
      return isFiniteNumber(value.angle);
    case 'style.strokeColor':
      return typeof value.strokeColor === 'string';
    case 'style.fillColor':
      return typeof value.fillColor === 'string';
    case 'style.strokeWidth':
      return isPositiveNumber(value.strokeWidth);
    case 'style.strokeStyle':
      return (
        value.strokeStyle === 'solid' ||
        value.strokeStyle === 'dashed' ||
        value.strokeStyle === 'dotted'
      );
    case 'style.opacity':
      return isRatio(value.opacity);
    case 'style.roughness':
      return value.roughness === null || isFiniteNumber(value.roughness);
    case 'text.text':
      return value.text === null || typeof value.text === 'string';
    case 'text.fontSize':
      return value.fontSize === null || isPositiveNumber(value.fontSize);
    case 'text.fontFamily':
      return value.fontFamily === null || typeof value.fontFamily === 'string';
    case 'text.textAlign':
      return (
        value.textAlign === null ||
        value.textAlign === 'left' ||
        value.textAlign === 'center' ||
        value.textAlign === 'right'
      );
    case 'geometry.points':
      return isPointList(value.points);
    case 'geometry.route':
      return value.route === null || isPointList(value.route);
    case 'geometry.startPoint':
      return value.startPoint === null || isPoint(value.startPoint);
    case 'geometry.endPoint':
      return value.endPoint === null || isPoint(value.endPoint);
    case 'binding.start':
      return value.binding === null || isArrowEndpointBinding(value.binding);
    case 'binding.end':
      return value.binding === null || isArrowEndpointBinding(value.binding);
    case 'order':
      return isFiniteNumber(value.zIndex);
    case 'asset.src':
      return value.src === null || typeof value.src === 'string';
    case 'embed.url':
      return value.url === null || typeof value.url === 'string';
    case 'grouping.groupId':
      return value.groupId === null || typeof value.groupId === 'string';
    case 'grouping.frameId':
      return value.frameId === null || typeof value.frameId === 'string';
    case 'state.locked':
      return typeof value.locked === 'boolean';
  }
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isRatio(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}
