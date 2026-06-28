import { useElementsStore } from './elements.store';
import { updateElements } from './mutation-pipeline';

/** Move the target element to the top of the stacking order. No-op if already at top. */
export function bringToFront(id: string): void {
  const { elements } = useElementsStore.getState();
  const active = elements.filter((e) => !e.isDeleted);
  const target = active.find((e) => e.id === id);
  if (!target) return;

  const maxZ = Math.max(...active.map((e) => e.zIndex));
  if (target.zIndex === maxZ) return; // already at top — no-op (AC-5)

  updateElements([{ id, patch: { zIndex: maxZ + 1 } }]);
}

/** Move the target element to the bottom of the stacking order. No-op if already at bottom. */
export function sendToBack(id: string): void {
  const { elements } = useElementsStore.getState();
  const active = elements.filter((e) => !e.isDeleted);
  const target = active.find((e) => e.id === id);
  if (!target) return;

  const minZ = Math.min(...active.map((e) => e.zIndex));
  if (target.zIndex === minZ) return; // already at bottom — no-op (AC-6)

  updateElements([{ id, patch: { zIndex: minZ - 1 } }]);
}

/** Move the target element one position higher. No-op if already at top. */
export function bringForward(id: string): void {
  const { elements } = useElementsStore.getState();
  const active = elements.filter((e) => !e.isDeleted);
  const target = active.find((e) => e.id === id);
  if (!target) return;

  const sorted = [...active].sort((a, b) => a.zIndex - b.zIndex);
  const above = sorted.find((e) => e.zIndex > target.zIndex);
  if (!above) return; // already at top — no-op (AC-5)

  updateElements([
    { id: target.id, patch: { zIndex: above.zIndex } },
    { id: above.id, patch: { zIndex: target.zIndex } },
  ]);
}

/** Move the target element one position lower. No-op if already at bottom. */
export function sendBackward(id: string): void {
  const { elements } = useElementsStore.getState();
  const active = elements.filter((e) => !e.isDeleted);
  const target = active.find((e) => e.id === id);
  if (!target) return;

  const sorted = [...active].sort((a, b) => a.zIndex - b.zIndex);
  const below = [...sorted].reverse().find((e) => e.zIndex < target.zIndex);
  if (!below) return; // already at bottom — no-op (AC-6)

  updateElements([
    { id: target.id, patch: { zIndex: below.zIndex } },
    { id: below.id, patch: { zIndex: target.zIndex } },
  ]);
}
