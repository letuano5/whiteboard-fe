import { computeBindingPoint, parseBinding } from '../../shapes/arrow-binding';
import { normalizeLinearBounds } from '../../../utils/geometry';
import type { Element } from '../../../types/shared';
import type { MeasureFn } from '../../text/text-wrap';
import { computeBoundTextLayout } from '../../text/text-wrap';
import { translatePointGeometry } from './point-geometry';
import { resolveGroupBinding } from './group';

export function computeBoundContainerCascade(
  containerDraft: Element,
  allElements: Element[],
  measure?: MeasureFn,
): Element[] {
  if (!containerDraft.groupId) return [];
  const binding = resolveGroupBinding(containerDraft.groupId, allElements);
  if (binding?.containerId !== containerDraft.id) return [];

  const container = allElements.find((el) => el.id === containerDraft.id && !el.isDeleted);
  const text = allElements.find((el) => el.id === binding.textId && !el.isDeleted);
  if (!container || !text || text.locked) return [];

  if (container.width === containerDraft.width && container.height === containerDraft.height) {
    const dx = containerDraft.x - container.x;
    const dy = containerDraft.y - container.y;
    return [{ ...text, x: text.x + dx, y: text.y + dy }];
  }

  const layout = computeBoundTextLayout(containerDraft, text, measure);
  return [
    {
      ...text,
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
      props: { ...text.props, textAlign: 'center' },
    },
  ];
}

export function computeGroupDragDrafts(
  groupMemberIds: string[],
  dx: number,
  dy: number,
  allElements: Element[],
  measure?: MeasureFn,
): Element[] {
  const memberIdSet = new Set(groupMemberIds);
  const drafts = allElements
    .filter((el) => memberIdSet.has(el.id) && !el.isDeleted && !el.locked)
    .map((el) => ({
      ...el,
      x: el.x + dx,
      y: el.y + dy,
      props: translatePointGeometry(el, dx, dy),
    }));

  const draftPositions = new Map(drafts.map((draft) => [draft.id, draft]));
  const boundArrows: Element[] = allElements
    .filter((arrow) => !arrow.isDeleted && arrow.type === 'arrow' && !memberIdSet.has(arrow.id))
    .filter((arrow) => {
      const startEl = parseBinding(arrow.props.startBinding)?.elementId;
      const endEl = parseBinding(arrow.props.endBinding)?.elementId;
      return (
        (startEl !== undefined && draftPositions.has(startEl)) ||
        (endEl !== undefined && draftPositions.has(endEl))
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
        const binding =
          idx === 0 ? parseBinding(arrow.props.startBinding) : parseBinding(arrow.props.endBinding);
        const draftEl = binding ? draftPositions.get(binding.elementId) : undefined;
        if (!binding || !draftEl) return [pt[0], pt[1]];
        const bp = computeBindingPoint(draftEl, binding.pointKey);
        return [bp.x, bp.y];
      });
      const bbox = normalizeLinearBounds(newPts);
      return { ...arrow, ...bbox, props: { ...arrow.props, points: newPts } };
    });

  const boundTextDrafts = drafts.flatMap((draft) =>
    computeBoundContainerCascade(draft, allElements, measure),
  );
  const byId = new Map([...drafts, ...boundArrows, ...boundTextDrafts].map((el) => [el.id, el]));
  return [...byId.values()];
}
