import type { Rect } from '../../../types/geometry';
import type { Element } from '../../../types/shared';
import type { MeasureFn } from '../../text/text-wrap';
import { computeBoundTextLayout } from '../../text/text-wrap';
import { resizePointGeometry } from './point-geometry';
import { resolveGroupBinding } from './group';

function scaleValue(
  value: number,
  oldStart: number,
  oldSize: number,
  newStart: number,
  newSize: number,
) {
  if (oldSize === 0) return newStart;
  return newStart + ((value - oldStart) / oldSize) * newSize;
}

function scaleElementBounds(element: Element, oldBounds: Rect, newBounds: Rect): Rect {
  const x = scaleValue(element.x, oldBounds.x, oldBounds.width, newBounds.x, newBounds.width);
  const y = scaleValue(element.y, oldBounds.y, oldBounds.height, newBounds.y, newBounds.height);
  const right = scaleValue(
    element.x + element.width,
    oldBounds.x,
    oldBounds.width,
    newBounds.x,
    newBounds.width,
  );
  const bottom = scaleValue(
    element.y + element.height,
    oldBounds.y,
    oldBounds.height,
    newBounds.y,
    newBounds.height,
  );
  return {
    x: Math.min(x, right),
    y: Math.min(y, bottom),
    width: Math.max(1, Math.abs(right - x)),
    height: Math.max(1, Math.abs(bottom - y)),
  };
}

export function computeGroupResizeDrafts(
  groupMemberIds: string[],
  oldBounds: Rect,
  newBounds: Rect,
  allElements: Element[],
  measure?: MeasureFn,
): Element[] {
  const memberIdSet = new Set(groupMemberIds);
  const members = allElements.filter((el) => memberIdSet.has(el.id) && !el.isDeleted && !el.locked);
  const bindings = new Map(
    [...new Set(members.map((el) => el.groupId).filter((id): id is string => id !== null))].map(
      (groupId) => [groupId, resolveGroupBinding(groupId, allElements)],
    ),
  );
  const resizedById = new Map<string, Element>();

  for (const member of members) {
    const binding = member.groupId ? bindings.get(member.groupId) : null;
    if (binding?.textId === member.id) continue;

    const bounds = scaleElementBounds(member, oldBounds, newBounds);
    const props =
      member.type === 'text' ? member.props : resizePointGeometry(member, bounds, false, false);
    resizedById.set(member.id, { ...member, ...bounds, props });
  }

  for (const member of members) {
    const binding = member.groupId ? bindings.get(member.groupId) : null;
    const bounds = scaleElementBounds(member, oldBounds, newBounds);

    if (binding?.textId === member.id) {
      const resizedContainer = resizedById.get(binding.containerId);
      if (resizedContainer) {
        const layout = computeBoundTextLayout(resizedContainer, member, measure);
        resizedById.set(member.id, {
          ...member,
          x: layout.x,
          y: layout.y,
          width: layout.width,
          height: layout.height,
          props: { ...member.props, textAlign: 'center' },
        });
      }
      continue;
    }

    if (member.type === 'text') {
      resizedById.set(member.id, { ...member, x: bounds.x, y: bounds.y });
    }
  }

  return [...resizedById.values()];
}
