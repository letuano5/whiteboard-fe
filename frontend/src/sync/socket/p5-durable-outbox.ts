import {
  clearDurableOutboxForRoom,
  hydrateDurableOutboxForRoom,
  removeDurableCommands,
  syncDurableQueueSnapshot,
} from './durable-outbox';
import { getSocketState, type QueuedSyncCommand } from './state';

const droppedDurableRequestIds = new Set<string>();
const hydratedDurableRequestIds = new Set<string>();

export async function hydratePendingSyncCommandsFromOutbox(roomId: string): Promise<void> {
  const state = getSocketState();
  const restored = await hydrateDurableOutboxForRoom(roomId);
  if (state.roomId !== roomId || restored.length === 0) return;

  const knownRequestIds = new Set(
    [...state.queuedSyncCommands, ...state.inFlightSyncCommands].map(
      (queued) => queued.command.requestId,
    ),
  );
  const missing = restored.filter(
    (queued) =>
      !knownRequestIds.has(queued.command.requestId) &&
      !droppedDurableRequestIds.has(queued.command.requestId),
  );
  if (missing.length === 0) return;

  for (const queued of missing) hydratedDurableRequestIds.add(queued.command.requestId);
  state.inFlightSyncCommands = [...state.inFlightSyncCommands, ...missing];
}

export function clearDurablePendingSyncCommands(roomId: string | null): void {
  if (!roomId) return;
  const state = getSocketState();
  for (const queued of [...state.queuedSyncCommands, ...state.inFlightSyncCommands]) {
    if (queued.command.roomId === roomId) {
      droppedDurableRequestIds.add(queued.command.requestId);
      hydratedDurableRequestIds.delete(queued.command.requestId);
    }
  }
  queueDurableOutboxTask(() => clearDurableOutboxForRoom(roomId));
}

export function dropDurablePendingSyncCommands(
  roomId: string | null,
  requestIds: readonly string[],
): void {
  if (!roomId || requestIds.length === 0) return;
  for (const requestId of requestIds) {
    droppedDurableRequestIds.add(requestId);
    hydratedDurableRequestIds.delete(requestId);
  }
  queueDurableOutboxTask(() => removeDurableCommands(roomId, requestIds));
}

export function consumeHydratedDurableRequestIds(): Set<string> {
  const requestIds = new Set(hydratedDurableRequestIds);
  hydratedDurableRequestIds.clear();
  return requestIds;
}

export function syncQueuedDurableSnapshot(
  roomId: string | null,
  before: readonly QueuedSyncCommand[],
  after: readonly QueuedSyncCommand[],
): void {
  if (!roomId) return;
  queueDurableOutboxTask(async () => {
    await syncDurableQueueSnapshot(
      roomId,
      before,
      after.filter((queued) => !droppedDurableRequestIds.has(queued.command.requestId)),
    );
    if (droppedDurableRequestIds.size > 0) {
      await removeDurableCommands(roomId, [...droppedDurableRequestIds]);
    }
  });
}

function queueDurableOutboxTask(task: () => Promise<void>): void {
  void task().catch((error: unknown) => {
    console.warn('[sync-outbox] durable outbox operation failed:', error);
  });
}
