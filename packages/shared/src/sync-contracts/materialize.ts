import type { Element } from '../index';
import type { CreateElementCommand, MaterializeCreateOptions, SyncOrderEntry } from './types';

export function materializeCreatedElement(
  command: CreateElementCommand,
  options: MaterializeCreateOptions = {},
): { element: Element; normalizedOrder: SyncOrderEntry } {
  const zIndex = options.zIndex ?? command.element.zIndex;
  const updatedAt = options.updatedAt ?? command.element.updatedAt;
  const element = { ...command.element, zIndex, updatedAt, isDeleted: false };

  return {
    element,
    normalizedOrder: { elementId: element.id, zIndex },
  };
}
