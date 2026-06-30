import { computeBindingPoint, parseBinding } from '../../shapes/arrow-binding';
import { normalizeLinearBounds } from '../../../utils/geometry';
import type { Element } from '../../../types/shared';
import { translatePointGeometry } from './point-geometry';

export function isFullyBoundArrow(el: Element): boolean {
  return (
    el.type === 'arrow' &&
    parseBinding(el.props.startBinding) !== null &&
    parseBinding(el.props.endBinding) !== null
  );
}

export function computeBoundArrowDrafts(draftTarget: Element, allElements: Element[]): Element[] {
  return allElements
    .filter((a) => !a.isDeleted && a.type === 'arrow' && a.id !== draftTarget.id)
    .filter(
      (a) =>
        parseBinding(a.props.startBinding)?.elementId === draftTarget.id ||
        parseBinding(a.props.endBinding)?.elementId === draftTarget.id,
    )
    .map((arrow) => {
      const srcPts: [number, number][] =
        arrow.props.points ??
        ([
          [0, 0],
          [0, 0],
        ] as [number, number][]);
      const newPts: [number, number][] = srcPts.map((pt, idx) => {
        const binding =
          idx === 0 ? parseBinding(arrow.props.startBinding) : parseBinding(arrow.props.endBinding);
        if (binding?.elementId === draftTarget.id) {
          const bp = computeBindingPoint(draftTarget, binding.pointKey);
          return [bp.x, bp.y];
        }
        return [pt[0], pt[1]];
      });
      const bbox = normalizeLinearBounds(newPts);
      return { ...arrow, ...bbox, props: { ...arrow.props, points: newPts } };
    });
}

export function computeMultiDragDrafts(
  selectedIds: string[],
  dx: number,
  dy: number,
  allElements: Element[],
): Element[] {
  const drafts = allElements
    .filter((el) => selectedIds.includes(el.id) && !el.isDeleted)
    .map((el) => ({
      ...el,
      x: el.x + dx,
      y: el.y + dy,
      props: translatePointGeometry(el, dx, dy),
    }));

  const draftPositions = new Map(drafts.map((d) => [d.id, d]));
  const selectedIdSet = new Set(selectedIds);
  const boundArrows: Element[] = allElements
    .filter((a) => !a.isDeleted && a.type === 'arrow' && !selectedIdSet.has(a.id))
    .filter((a) => {
      const startEl = parseBinding(a.props.startBinding)?.elementId;
      const endEl = parseBinding(a.props.endBinding)?.elementId;
      return (
        (startEl !== undefined && selectedIdSet.has(startEl)) ||
        (endEl !== undefined && selectedIdSet.has(endEl))
      );
    })
    .map((arrow) => {
      const srcPts =
        arrow.props.points ??
        ([
          [0, 0],
          [0, 0],
        ] as [number, number][]);
      const newPts: [number, number][] = srcPts.map((pt, idx) => {
        const isStart = idx === 0;
        const binding = isStart
          ? parseBinding(arrow.props.startBinding)
          : parseBinding(arrow.props.endBinding);
        if (binding && selectedIdSet.has(binding.elementId)) {
          const draftEl = draftPositions.get(binding.elementId);
          if (draftEl) {
            const bp = computeBindingPoint(draftEl, binding.pointKey);
            return [bp.x, bp.y];
          }
        }
        return [pt[0], pt[1]];
      });
      const bbox = normalizeLinearBounds(newPts);
      return { ...arrow, ...bbox, props: { ...arrow.props, points: newPts } };
    });

  return [...drafts, ...boundArrows];
}
