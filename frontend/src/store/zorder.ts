import { useElementsStore } from './elements.store';
import { updateElements } from './mutation-pipeline';
import { resolveGroupBinding } from '../canvas/tools/select/group';

type ElementList = ReturnType<typeof useElementsStore.getState>['elements'];

function getBoundZOrderPatch(
  targetId: string,
  nextZIndex: number,
  active = useElementsStore.getState().elements,
) {
  const target = active.find((e) => e.id === targetId && !e.isDeleted);
  if (!target?.groupId)
    return { noop: false, patches: [{ id: targetId, patch: { zIndex: nextZIndex } }] };

  const binding = resolveGroupBinding(target.groupId, active);
  if (binding?.textId === target.id) return { noop: true, patches: [] };
  if (binding?.containerId !== target.id) {
    return { noop: false, patches: [{ id: targetId, patch: { zIndex: nextZIndex } }] };
  }

  return {
    noop: false,
    patches: [
      { id: targetId, patch: { zIndex: nextZIndex } },
      { id: binding.textId, patch: { zIndex: nextZIndex + 1 } },
    ],
  };
}

function isBoundTextElement(elementId: string, active: ElementList) {
  const element = active.find((candidate) => candidate.id === elementId && !candidate.isDeleted);
  if (!element?.groupId) return false;
  return resolveGroupBinding(element.groupId, active)?.textId === element.id;
}

function getOwnBoundTextId(targetId: string, active: ElementList): string | null {
  const target = active.find((element) => element.id === targetId && !element.isDeleted);
  if (!target?.groupId) return null;
  const binding = resolveGroupBinding(target.groupId, active);
  return binding?.containerId === target.id ? binding.textId : null;
}

function getStepCandidates(active: ElementList, ownBoundTextId: string | null): ElementList {
  return active.filter(
    (element) => element.id !== ownBoundTextId && !isBoundTextElement(element.id, active),
  );
}

/** Move the target element to the top of the stacking order. No-op if already at top. */
export function bringToFront(id: string): void {
  const { elements } = useElementsStore.getState();
  const active = elements.filter((e) => !e.isDeleted);
  const target = active.find((e) => e.id === id);
  if (!target) return;

  const maxZ = Math.max(...active.map((e) => e.zIndex));
  if (target.zIndex === maxZ) return; // already at top — no-op (AC-5)

  const { noop, patches } = getBoundZOrderPatch(id, maxZ + 1, active);
  if (noop) return;
  updateElements(patches);
}

/** Move the target element to the bottom of the stacking order. No-op if already at bottom. */
export function sendToBack(id: string): void {
  const { elements } = useElementsStore.getState();
  const active = elements.filter((e) => !e.isDeleted);
  const target = active.find((e) => e.id === id);
  if (!target) return;

  const minZ = Math.min(...active.map((e) => e.zIndex));
  if (target.zIndex === minZ) return; // already at bottom — no-op (AC-6)

  const { noop, patches } = getBoundZOrderPatch(id, minZ - 1, active);
  if (noop) return;
  updateElements(patches);
}

/** Move the target element one position higher. No-op if already at top. */
export function bringForward(id: string): void {
  const { elements } = useElementsStore.getState();
  const active = elements.filter((e) => !e.isDeleted);
  const target = active.find((e) => e.id === id);
  if (!target) return;

  const sorted = [...getStepCandidates(active, getOwnBoundTextId(target.id, active))].sort(
    (a, b) => a.zIndex - b.zIndex,
  );
  const above = sorted.find((e) => e.zIndex > target.zIndex);
  if (!above) return; // already at top — no-op (AC-5)

  const { noop, patches } = getBoundZOrderPatch(target.id, above.zIndex, active);
  if (noop) return;
  updateElements([...patches, { id: above.id, patch: { zIndex: target.zIndex } }]);
}

/** Move the target element one position lower. No-op if already at bottom. */
export function sendBackward(id: string): void {
  const { elements } = useElementsStore.getState();
  const active = elements.filter((e) => !e.isDeleted);
  const target = active.find((e) => e.id === id);
  if (!target) return;

  const sorted = [...getStepCandidates(active, getOwnBoundTextId(target.id, active))].sort(
    (a, b) => a.zIndex - b.zIndex,
  );
  const below = [...sorted].reverse().find((e) => e.zIndex < target.zIndex);
  if (!below) return; // already at bottom — no-op (AC-6)

  const { noop, patches } = getBoundZOrderPatch(target.id, below.zIndex, active);
  if (noop) return;
  updateElements([...patches, { id: below.id, patch: { zIndex: target.zIndex } }]);
}
