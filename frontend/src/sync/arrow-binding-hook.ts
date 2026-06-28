import type { MutationEvent } from '../store/mutation-pipeline';
import { updateElements } from '../store/mutation-pipeline';
import { useElementsStore } from '../store/elements.store';
import { parseBinding, computeBindingPoint } from '../canvas/shapes/arrow-binding';

type MutationHook = (event: MutationEvent) => void;

/**
 * Creates a mutation hook that cascades arrow endpoint updates whenever a
 * non-arrow element is mutated (moved, resized, or deleted).
 *
 * Registration: call `registerMutationHook(createArrowBindingHook())` once on
 * app mount. Deregister on unmount via the returned cleanup function.
 */
export function createArrowBindingHook(): MutationHook {
  // Guard against recursive fire: when we call updateElements for arrows,
  // the hook fires again. We skip if the re-fired event is only for arrows.
  let _updating = false;

  return function arrowBindingHook(event: MutationEvent): void {
    if (_updating) return;

    // Only care about patch/update/delete events (not create — new elements
    // have no bound arrows yet by definition).
    if (event.type === 'create') return;

    // Collect IDs of non-arrow elements that changed.
    const mutatedShapeIds = new Set(
      event.elements
        .filter((el) => el.type !== 'arrow' && el.type !== 'line')
        .map((el) => el.id),
    );
    if (mutatedShapeIds.size === 0) return;

    const { elements } = useElementsStore.getState();

    // Current state of mutated shapes (already updated in store by the time hooks fire).
    const shapeMap = new Map(elements.filter((e) => mutatedShapeIds.has(e.id)).map((e) => [e.id, e]));

    // Build patches for arrows bound to any mutated shape.
    const patches: { id: string; patch: Parameters<typeof updateElements>[0][number]['patch'] }[] = [];

    for (const el of elements) {
      if (el.isDeleted) continue;
      if (el.type !== 'arrow') continue;

      const startParsed = parseBinding(el.props.startBinding);
      const endParsed = parseBinding(el.props.endBinding);

      const startAffected = startParsed && mutatedShapeIds.has(startParsed.elementId);
      const endAffected = endParsed && mutatedShapeIds.has(endParsed.elementId);

      if (!startAffected && !endAffected) continue;

      const currentPoints = el.props.points ? [...el.props.points.map((p) => [...p] as [number, number])] : [];

      let newStartBinding = el.props.startBinding;
      let newEndBinding = el.props.endBinding;

      if (startAffected && startParsed) {
        const target = shapeMap.get(startParsed.elementId);
        if (target && target.isDeleted) {
          // Shape deleted: release binding, keep current point position
          newStartBinding = null;
        } else if (target) {
          // Shape moved/resized: recompute attachment point
          const pt = computeBindingPoint(target, startParsed.pointKey);
          if (currentPoints.length > 0) {
            currentPoints[0] = [pt.x, pt.y];
          }
        }
      }

      if (endAffected && endParsed) {
        const target = shapeMap.get(endParsed.elementId);
        if (target && target.isDeleted) {
          // Shape deleted: release binding, keep current point position
          newEndBinding = null;
        } else if (target) {
          const pt = computeBindingPoint(target, endParsed.pointKey);
          if (currentPoints.length > 1) {
            currentPoints[currentPoints.length - 1] = [pt.x, pt.y];
          }
        }
      }

      patches.push({
        id: el.id,
        patch: {
          props: {
            ...el.props,
            points: currentPoints,
            startBinding: newStartBinding ?? undefined,
            endBinding: newEndBinding ?? undefined,
          },
        },
      });
    }

    if (patches.length === 0) return;

    _updating = true;
    try {
      updateElements(patches);
    } finally {
      _updating = false;
    }
  };
}
