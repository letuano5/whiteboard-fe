import type { Point } from '../../types/geometry';
import type { Element } from '../../types/shared';
import { unrotatePoint } from '../../utils/geometry';
import { getShapeUtil } from './index';

/**
 * Hit-tests a world-space point against an element, un-rotating the point
 * around the element's bbox center first so rotated elements (`angle !== 0`)
 * are tested against their visible geometry instead of their unrotated bbox.
 */
export function hitTestElementAtWorldPoint(el: Element, pt: Point): boolean {
  const util = getShapeUtil(el.type);
  if (!util) return false;
  const center = { x: el.x + el.width / 2, y: el.y + el.height / 2 };
  const localPt = el.angle !== 0 ? unrotatePoint(pt, center, el.angle) : pt;
  return util.hitTest(el, localPt.x, localPt.y);
}
