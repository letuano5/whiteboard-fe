import type {
  Element,
  PatchSlotsCommand,
  PendingRequestStatus,
  SlotValue,
  SyncCommand,
  SyncSlot,
} from '../../types/shared';
import { WS_EVENTS } from '../../types/shared';
import type { MutationEvent } from '../../store/mutation-pipeline';
import { compactQueuedSyncCommands, enqueueCoalescedPatch } from './p5-command-backpressure';
import { commandsFromMutation } from './p5-command-from-mutation';
import { isCommandRelevantForResend, requestBackpressureResync } from './p5-command-resync';
import { dropDurablePendingSyncCommands, syncQueuedDurableSnapshot } from './p5-durable-outbox';
import {
  applyOptimisticCommand,
  cloneElement,
  commandElementIds,
  createPatchCommand,
} from './p5-command-materializer';
import { getKnownSlotClock, getSocketState, type QueuedSyncCommand } from './state';

export const DURABLE_DRAG_FLUSH_MS = 100;
export const PRESENCE_PREVIEW_THROTTLE_MS = 33;
export const MAX_IN_FLIGHT_COMMANDS_PER_CLIENT_ROOM = 2;
export const MAX_QUEUED_COMMANDS_PER_CLIENT_ROOM = 64;
export const MAX_UNSENT_PATCHES_PER_ELEMENT_SLOT = 1;

interface EnqueueOptions {
  final?: boolean;
  now?: number;
}

export interface EnqueueResult {
  status: 'queued' | 'empty' | 'paused';
  queuedCount: number;
}

export type UndoPatchResult =
  | { status: 'ready'; command: PatchSlotsCommand }
  | { status: 'conflict'; reason: 'slot-clock-changed' };

export function enqueueMutationSyncCommands(
  event: MutationEvent,
  roomId: string,
  options: EnqueueOptions = {},
): EnqueueResult {
  const now = options.now ?? Date.now();
  const commands = commandsFromMutation(event, roomId, now, options.final ?? false);
  if (commands.length === 0) return { status: 'empty', queuedCount: 0 };

  const state = getSocketState();
  for (const command of commands) {
    enqueueCommand(command, now, options.final ?? isDiscreteCommand(command));
  }
  enforceBackpressure();

  if (state.pausedForResync)
    return { status: 'paused', queuedCount: state.queuedSyncCommands.length };
  scheduleOrFlush(options.final ?? commands.some(isDiscreteCommand));
  return { status: 'queued', queuedCount: commands.length };
}

export function flushPendingSyncCommands(force = false): void {
  const state = getSocketState();
  if (!state.socket || !state.roomId || state.pausedForResync) return;
  if ((state.socket as { connected?: boolean }).connected === false) return;
  const now = Date.now();

  while (
    state.inFlightSyncCommands.length < MAX_IN_FLIGHT_COMMANDS_PER_CLIENT_ROOM &&
    state.queuedSyncCommands.length > 0
  ) {
    const next = state.queuedSyncCommands[0];
    if (!next) return;
    if (!force && next.sendAfter > now) return;
    if (promoteQueuedDependency(next)) continue;
    if (
      next.dependsOnRequestId &&
      state.inFlightSyncCommands.some(
        (queued) => queued.command.requestId === next.dependsOnRequestId,
      )
    ) {
      return;
    }

    state.queuedSyncCommands = state.queuedSyncCommands.slice(1);
    state.inFlightSyncCommands = [...state.inFlightSyncCommands, next];
    state.pendingSyncRequests = [
      ...state.pendingSyncRequests,
      { requestId: next.command.requestId, actorId: null, clientClock: next.command.clientClock },
    ];
    state.socket.emit(WS_EVENTS.SYNC_COMMAND, next.command);
  }

  scheduleNextFlush();
}

export function hasPendingSyncWork(): boolean {
  const state = getSocketState();
  return state.queuedSyncCommands.length > 0 || state.inFlightSyncCommands.length > 0;
}

/**
 * Forces a flush and waits for queued/in-flight sync commands to settle, so
 * navigation away from the canvas (e.g. back to the dashboard) doesn't race
 * ahead of a just-issued delete/patch that hasn't reached the server yet.
 * Falls back to `timeoutMs` so a stuck connection can't block navigation forever.
 */
export function waitForSyncIdle(timeoutMs = 2000): Promise<void> {
  flushPendingSyncCommands(true);
  if (!hasPendingSyncWork()) return Promise.resolve();

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const poll = (): void => {
      flushPendingSyncCommands(true);
      if (!hasPendingSyncWork() || Date.now() >= deadline) {
        resolve();
        return;
      }
      setTimeout(poll, 50);
    };
    poll();
  });
}

export function clearPendingSyncCommands(): void {
  const state = getSocketState();
  state.queuedSyncCommands = [];
  state.inFlightSyncCommands = [];
  state.pendingSyncRequests = [];
  state.pausedForResync = false;
  if (state.syncFlushTimer !== null) {
    clearTimeout(state.syncFlushTimer);
    state.syncFlushTimer = null;
  }
}

export function settleSyncCommandRequest(requestId: string): void {
  const state = getSocketState();
  state.inFlightSyncCommands = state.inFlightSyncCommands.filter(
    (queued) => queued.command.requestId !== requestId,
  );
  dropDurablePendingSyncCommands(state.roomId, [requestId]);
  flushPendingSyncCommands();
}

export function reconcilePendingCommandStatuses(statuses: PendingRequestStatus[]): void {
  const state = getSocketState();
  const resendableUnknown: QueuedSyncCommand[] = [];
  for (const status of statuses) {
    if (
      status.status === 'processed' ||
      status.status === 'conflict' ||
      status.status === 'expired'
    ) {
      state.inFlightSyncCommands = state.inFlightSyncCommands.filter(
        (queued) => queued.command.requestId !== status.requestId,
      );
      state.queuedSyncCommands = state.queuedSyncCommands.filter(
        (queued) => queued.command.requestId !== status.requestId,
      );
      dropDurablePendingSyncCommands(state.roomId, [status.requestId]);
      continue;
    }

    const sent = state.inFlightSyncCommands.find(
      (queued) => queued.command.requestId === status.requestId,
    );
    if (!sent) continue;
    state.inFlightSyncCommands = state.inFlightSyncCommands.filter(
      (queued) => queued.command.requestId !== status.requestId,
    );
    state.pendingSyncRequests = state.pendingSyncRequests.filter(
      (request) => request.requestId !== status.requestId,
    );
    if (isCommandRelevantForResend(sent.command)) {
      resendableUnknown.push({ ...sent, sendAfter: Date.now() });
    } else {
      state.staleAckRequestIds.add(status.requestId);
      dropDurablePendingSyncCommands(state.roomId, [status.requestId]);
    }
  }
  if (resendableUnknown.length > 0) {
    resendableUnknown.sort((left, right) => left.createdAt - right.createdAt);
    state.queuedSyncCommands = [...resendableUnknown, ...state.queuedSyncCommands];
  }
}

export function materializeOptimisticElements(serverElements: readonly Element[]): Element[] {
  const state = getSocketState();
  let next = serverElements.map(cloneElement);
  for (const queued of [...state.inFlightSyncCommands, ...state.queuedSyncCommands]) {
    next = applyOptimisticCommand(next, queued.command);
  }
  return next;
}

export function createUndoPatchCommand(
  roomId: string,
  elementId: string,
  slot: SyncSlot,
  inverseChanges: SlotValue,
  afterSlotClock: number,
): UndoPatchResult {
  if (getKnownSlotClock(elementId, slot) !== afterSlotClock) {
    return { status: 'conflict', reason: 'slot-clock-changed' };
  }

  return {
    status: 'ready',
    command: createPatchCommand(
      roomId,
      [
        {
          elementId,
          slot,
          baseClock: afterSlotClock,
          changes: inverseChanges,
        },
      ],
      Date.now(),
      true,
    ),
  };
}

function enqueueCommand(command: SyncCommand, now: number, forceImmediate: boolean): void {
  const state = getSocketState();
  const beforeQueue = state.queuedSyncCommands;
  const queued: QueuedSyncCommand = {
    command,
    dependsOnRequestId: dependencyForCommand(command),
    sendAfter: forceImmediate ? now : now + DURABLE_DRAG_FLUSH_MS,
    createdAt: now,
  };

  if (command.kind === 'patch-slots') {
    state.queuedSyncCommands = enqueueCoalescedPatch(state.queuedSyncCommands, queued);
    syncQueuedDurableSnapshot(state.roomId, beforeQueue, state.queuedSyncCommands);
    return;
  }
  state.queuedSyncCommands = [...state.queuedSyncCommands, queued];
  syncQueuedDurableSnapshot(state.roomId, beforeQueue, state.queuedSyncCommands);
}

function enforceBackpressure(): void {
  const state = getSocketState();
  if (state.queuedSyncCommands.length <= MAX_QUEUED_COMMANDS_PER_CLIENT_ROOM) return;

  state.queuedSyncCommands = compactQueuedSyncCommands(state.queuedSyncCommands);
  if (state.queuedSyncCommands.length > MAX_QUEUED_COMMANDS_PER_CLIENT_ROOM) {
    if (state.pausedForResync) return;
    state.pausedForResync = true;
    requestBackpressureResync();
  }
}

function scheduleOrFlush(immediate: boolean): void {
  if (immediate) {
    flushPendingSyncCommands(true);
    return;
  }
  scheduleNextFlush();
}

function scheduleNextFlush(): void {
  const state = getSocketState();
  if (state.syncFlushTimer !== null || state.queuedSyncCommands.length === 0) return;
  const next = state.queuedSyncCommands[0];
  if (!next) return;
  const delay = Math.max(0, next.sendAfter - Date.now());
  state.syncFlushTimer = setTimeout(() => {
    const current = getSocketState();
    current.syncFlushTimer = null;
    flushPendingSyncCommands();
  }, delay);
}

function dependencyForCommand(command: SyncCommand): string | undefined {
  const state = getSocketState();
  const elementIds = commandElementIds(command);
  const create = [...state.inFlightSyncCommands, ...state.queuedSyncCommands].find(
    (queued) =>
      queued.command.kind === 'create-element' && elementIds.includes(queued.command.element.id),
  );
  return create?.command.requestId;
}

function isDiscreteCommand(command: SyncCommand): boolean {
  return command.kind !== 'patch-slots';
}

function promoteQueuedDependency(next: QueuedSyncCommand): boolean {
  if (!next.dependsOnRequestId) return false;
  const state = getSocketState();
  const dependencyIndex = state.queuedSyncCommands.findIndex(
    (queued) => queued.command.requestId === next.dependsOnRequestId,
  );
  if (dependencyIndex <= 0) return false;

  const dependency = state.queuedSyncCommands[dependencyIndex];
  if (!dependency) return false;
  state.queuedSyncCommands = [
    dependency,
    ...state.queuedSyncCommands.slice(0, dependencyIndex),
    ...state.queuedSyncCommands.slice(dependencyIndex + 1),
  ];
  return true;
}
