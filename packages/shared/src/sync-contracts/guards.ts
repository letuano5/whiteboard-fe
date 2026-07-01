import type { Element } from '../index';
import type { PointTuple, SyncOrderHint, SyncReadPrecondition, SyncSlot } from './types';

export const SYNC_SLOTS = new Set<SyncSlot>([
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
]);

export function isReadPreconditions(value: unknown): value is SyncReadPrecondition[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.elementId === 'string' &&
        isSyncSlot(item.slot) &&
        isFiniteNumber(item.expectedClock),
    )
  );
}

export function isOrderHint(value: unknown): value is SyncOrderHint {
  if (!isRecord(value)) return false;
  return (
    (value.afterElementId === undefined || typeof value.afterElementId === 'string') &&
    (value.beforeElementId === undefined || typeof value.beforeElementId === 'string') &&
    (value.baseOrderClock === undefined || isFiniteNumber(value.baseOrderClock))
  );
}

export function isSyncSlot(value: unknown): value is SyncSlot {
  return typeof value === 'string' && SYNC_SLOTS.has(value as SyncSlot);
}

export function isElementLike(value: unknown): value is Element {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    isFiniteNumber(value.angle) &&
    isFiniteNumber(value.zIndex) &&
    isRecord(value.props) &&
    isFiniteNumber(value.version) &&
    isFiniteNumber(value.versionNonce) &&
    isFiniteNumber(value.updatedAt) &&
    typeof value.isDeleted === 'boolean' &&
    (typeof value.groupId === 'string' || value.groupId === null) &&
    (typeof value.frameId === 'string' || value.frameId === null) &&
    typeof value.locked === 'boolean' &&
    typeof value.createdBy === 'string'
  );
}

export function isPointList(value: unknown): value is PointTuple[] {
  return Array.isArray(value) && value.every((point) => isPoint(point));
}

export function isPoint(value: unknown): value is PointTuple {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1])
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
