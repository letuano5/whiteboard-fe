import { createElement, patchElement } from '../../../store/mutation-pipeline';
import type { Element, ElementProps } from '../../../types/shared';
import { generateId } from '../../../utils/id';
import { computeBoundTextLayout } from '../../text/text-wrap';

const BOUND_TEXT_PROPS: ElementProps = {
  strokeColor: '#1a1a1a',
  fillColor: 'transparent',
  strokeWidth: 1,
  strokeStyle: 'solid',
  opacity: 1,
  text: '',
  fontSize: 16,
  fontFamily: 'sans-serif',
  textAlign: 'center',
};

/**
 * Creates a new centered, width-wrapped text label bound to `container` (assigning it a shared
 * `groupId` with the container, generating one if the container isn't grouped yet) and returns
 * the new text element so the caller can move it straight into edit mode.
 */
export function createBoundTextForContainer(container: Element, createdBy = ''): Element {
  const groupId = container.groupId ?? generateId();
  const layout = computeBoundTextLayout(container, { props: BOUND_TEXT_PROPS });

  const text = createElement({
    type: 'text',
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    props: BOUND_TEXT_PROPS,
    angle: 0,
    groupId,
    frameId: null,
    locked: false,
    createdBy,
  });

  if (container.groupId !== groupId) {
    patchElement(container.id, { groupId });
  }

  return text;
}
