import type { Element, ElementType } from '../../../types/shared';

export const CONTAINER_TYPES = new Set<ElementType>([
  'rectangle',
  'ellipse',
  'diamond',
  'triangle',
  'polygon',
  'image',
]);

export interface GroupBinding {
  textId: string;
  containerId: string;
}

export function resolveGroupMembers(groupId: string, elements: Element[]): Element[] {
  return elements.filter((el) => !el.isDeleted && el.groupId === groupId);
}

export function resolveGroupMemberIds(groupId: string, elements: Element[]): string[] {
  return resolveGroupMembers(groupId, elements).map((el) => el.id);
}

export function resolveSelectionGroupIds(
  selectedIds: string[],
  elements: Element[],
): string[] | null {
  if (selectedIds.length === 0) return null;
  const selected = elements.filter((el) => selectedIds.includes(el.id) && !el.isDeleted);
  if (selected.length === 0) return null;
  if (selected.some((el) => el.groupId === null)) return null;
  const groupIds = new Set(
    selected.map((el) => el.groupId).filter((id): id is string => id !== null),
  );
  if (groupIds.size !== 1) return null;
  const [groupId] = [...groupIds];
  const memberIds = resolveGroupMemberIds(groupId, elements);
  return memberIds.length > 1 ? memberIds : null;
}

export function resolveGroupBinding(groupId: string, elements: Element[]): GroupBinding | null {
  const members = resolveGroupMembers(groupId, elements);
  const texts = members.filter((el) => el.type === 'text');
  const containers = members.filter((el) => CONTAINER_TYPES.has(el.type));
  if (texts.length !== 1 || containers.length !== 1) return null;
  return { textId: texts[0].id, containerId: containers[0].id };
}

export function resolveGroupDeletionIds(selectedIds: string[], elements: Element[]): string[] {
  const ids = new Set<string>();

  for (const selectedId of selectedIds) {
    const selected = elements.find((el) => el.id === selectedId && !el.isDeleted);
    if (!selected) continue;
    if (!selected.groupId) {
      ids.add(selected.id);
      continue;
    }
    resolveGroupMembers(selected.groupId, elements)
      .filter((el) => !el.locked)
      .forEach((el) => ids.add(el.id));
  }

  return [...ids];
}
