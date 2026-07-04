import { updateElements } from '../../../store/mutation-pipeline';
import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import type { Element } from '../../../types/shared';
import { generateId } from '../../../utils/id';
import { computeBoundTextLayout } from '../../text/text-wrap';
import { resolveGroupBinding, resolveGroupMembers } from './group';

type ElementPatch = Partial<Omit<Element, 'id' | 'version' | 'versionNonce' | 'updatedAt'>>;

export function resolveMergedGroupId(selected: Element[]): string {
  const existingGroupIds = new Set(
    selected.map((el) => el.groupId).filter((id): id is string => id !== null),
  );
  if (existingGroupIds.size === 1) return [...existingGroupIds][0];
  return generateId();
}

export function canMergeSelection(elements: Element[], selectedIds: string[]): boolean {
  const selected = elements.filter(
    (el) => selectedIds.includes(el.id) && !el.isDeleted && !el.locked,
  );
  return selected.length >= 2;
}

export function canUnmergeSelection(elements: Element[], selectedIds: string[]): boolean {
  return elements.some((el) => selectedIds.includes(el.id) && !el.isDeleted && el.groupId !== null);
}

export function onMergeSelected(): void {
  const { selectedIds } = useInteractionStore.getState();
  const elements = useElementsStore.getState().elements;
  const selected = elements.filter(
    (el) => selectedIds.includes(el.id) && !el.isDeleted && !el.locked,
  );
  if (selected.length < 2) return;

  const groupId = resolveMergedGroupId(selected);
  const selectedIdsSet = new Set(selected.map((el) => el.id));
  const elementsAfterMerge = elements.map((el) =>
    selectedIdsSet.has(el.id) ? { ...el, groupId } : el,
  );
  const binding = resolveGroupBinding(groupId, elementsAfterMerge);
  const patches: { id: string; patch: ElementPatch }[] = selected.map((el) => ({
    id: el.id,
    patch: { groupId },
  }));

  if (binding) {
    const container = elementsAfterMerge.find((el) => el.id === binding.containerId);
    const text = elementsAfterMerge.find((el) => el.id === binding.textId);
    if (container && text && selectedIdsSet.has(text.id)) {
      const layout = computeBoundTextLayout(container, text);
      const patch = patches.find((entry) => entry.id === text.id);
      if (patch) {
        patch.patch = {
          ...patch.patch,
          x: layout.x,
          y: layout.y,
          width: layout.width,
          height: layout.height,
          zIndex: container.zIndex + 1,
          props: { ...text.props, textAlign: 'center' },
        };
      }
    }
  }

  updateElements(patches);
}

export function onUnmergeSelected(): void {
  const { selectedIds } = useInteractionStore.getState();
  const elements = useElementsStore.getState().elements;
  const selectedGroupIds = new Set(
    elements
      .filter((el) => selectedIds.includes(el.id) && !el.isDeleted && el.groupId !== null)
      .map((el) => el.groupId as string),
  );
  if (selectedGroupIds.size === 0) return;

  const members = [...selectedGroupIds].flatMap((groupId) =>
    resolveGroupMembers(groupId, elements),
  );
  const memberIds = [...new Set(members.map((el) => el.id))];
  updateElements(memberIds.map((id) => ({ id, patch: { groupId: null } })));
}
