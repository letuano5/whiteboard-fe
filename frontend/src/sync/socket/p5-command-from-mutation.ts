import type { Element, SyncCommand } from '../../types/shared';
import type { MutationEvent } from '../../store/mutation-pipeline';
import {
  createDeleteCommand,
  createElementCommand,
  createPatchCommand,
  createReorderCommand,
  diffElementSlots,
} from './p5-command-materializer';
import { getSocketState } from './state';

export function commandsFromMutation(
  event: MutationEvent,
  roomId: string,
  now: number,
  final: boolean,
): SyncCommand[] {
  if (event.type === 'create') {
    return event.elements.map((element) => createElementCommand(roomId, element, now, final));
  }

  if (event.type === 'delete') {
    const elementIds = event.before.map((element) => element.id);
    cancelUnsentCreates(elementIds);
    const remainingIds = elementIds.filter((elementId) => !hasQueuedCreate(elementId));
    if (remainingIds.length === 0) return [];
    return [createDeleteCommand(roomId, remainingIds, now)];
  }

  const patches = event.elements.flatMap((after, index) => {
    const before = event.before[index] ?? event.before.find((element) => element.id === after.id);
    if (!before) return [];
    return diffElementSlots(before, after);
  });
  squashPatchesIntoUnsentCreates(event.elements);
  const createdReorder = createReorderCommand(roomId, event.before, event.elements, now);
  const reorderMoves = createdReorder?.moves.filter((move) => !hasQueuedCreate(move.elementId));
  const reorder =
    createdReorder && reorderMoves && reorderMoves.length > 0
      ? { ...createdReorder, moves: reorderMoves }
      : null;
  if (patches.length === 0) return reorder ? [reorder] : [];
  const remainingPatches = patches.filter((patch) => !hasQueuedCreate(patch.elementId));
  const commands: SyncCommand[] = [];
  if (reorder) commands.push(reorder);
  if (remainingPatches.length > 0) {
    commands.push(
      createPatchCommand(roomId, remainingPatches, now, final, event.sync?.readPreconditions),
    );
  }
  return commands;
}

function cancelUnsentCreates(elementIds: string[]): void {
  const state = getSocketState();
  const ids = new Set(elementIds);
  state.queuedSyncCommands = state.queuedSyncCommands.filter(
    (queued) => queued.command.kind !== 'create-element' || !ids.has(queued.command.element.id),
  );
}

function hasQueuedCreate(elementId: string): boolean {
  return getSocketState().queuedSyncCommands.some(
    (queued) => queued.command.kind === 'create-element' && queued.command.element.id === elementId,
  );
}

function squashPatchesIntoUnsentCreates(elements: Element[]): void {
  const state = getSocketState();
  const byId = new Map(elements.map((element) => [element.id, element]));
  state.queuedSyncCommands = state.queuedSyncCommands.map((queued) => {
    if (queued.command.kind !== 'create-element') return queued;
    const replacement = byId.get(queued.command.element.id);
    return replacement
      ? { ...queued, command: { ...queued.command, element: replacement } }
      : queued;
  });
}
