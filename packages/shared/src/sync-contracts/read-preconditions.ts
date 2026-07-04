import { isRecord, isSyncSlot } from './guards';
import type { SyncCommand, SyncReadPrecondition, SyncValidationContext } from './types';

export interface StaleReadPrecondition {
  elementId: string;
  slot: SyncReadPrecondition['slot'];
  baseClock: number;
  currentClock: number;
  onStale: SyncReadPrecondition['onStale'];
}

export function getStaleReadPreconditions(
  command: SyncCommand,
  context: SyncValidationContext = {},
): StaleReadPrecondition[] {
  if (!context.currentSlotClocks) return [];
  if (!Array.isArray(command.readPreconditions)) return [];

  return command.readPreconditions.flatMap((precondition) => {
    const currentClock = getCurrentSlotClock(context, precondition.elementId, precondition.slot);
    if (precondition.baseClock >= currentClock) return [];

    return [
      {
        elementId: precondition.elementId,
        slot: precondition.slot,
        baseClock: precondition.baseClock,
        currentClock,
        onStale: precondition.onStale,
      },
    ];
  });
}

export function getCurrentSlotClock(
  context: SyncValidationContext,
  elementId: string,
  slot: SyncReadPrecondition['slot'],
): number {
  return context.currentSlotClocks?.get(getSlotClockKey(elementId, slot)) ?? 0;
}

export function getSlotClockKey(elementId: string, slot: SyncReadPrecondition['slot']): string {
  return `${elementId}:${slot}`;
}

export function isSlotReadPrecondition(value: unknown): value is SyncReadPrecondition {
  return (
    isRecord(value) &&
    typeof value.elementId === 'string' &&
    isSyncSlot(value.slot) &&
    typeof value.baseClock === 'number' &&
    Number.isFinite(value.baseClock) &&
    (value.onStale === 'reject' ||
      value.onStale === 'rebase' ||
      value.onStale === 'server_recompute')
  );
}
