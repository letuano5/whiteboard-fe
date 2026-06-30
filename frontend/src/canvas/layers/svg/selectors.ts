import type { Element } from '../../../types/shared';
import type { Point } from '../../../types/geometry';
import type { ToolId } from '../../../types/interaction';
import { findNearestSnap } from '../../shapes/arrow-binding';
import type { MultiSelectBounds } from './types';

export function getVisibleElements(
  elements: Element[],
  draftElement: Element | null | undefined,
  draftElements: Element[],
  remoteDrafts: Map<string, Element[]>,
) {
  const draftElementIds = new Set(draftElements.map((el) => el.id));
  const remoteDraftIds = new Set(
    Array.from(remoteDrafts.values()).flatMap((draftEls) => draftEls.map((el) => el.id)),
  );

  return elements
    .filter(
      (el) =>
        !el.isDeleted &&
        el.id !== draftElement?.id &&
        !draftElementIds.has(el.id) &&
        !remoteDraftIds.has(el.id),
    )
    .sort((a, b) => a.zIndex - b.zIndex);
}

export function getSelectedOverlayElement(
  elements: Element[],
  selectedIds: string[],
  draftElement: Element | null | undefined,
) {
  if (selectedIds.length !== 1) return null;

  const selectedElement = elements.find((el) => el.id === selectedIds[0] && !el.isDeleted);
  if (!selectedElement) return null;

  return draftElement?.id === selectedElement.id ? draftElement : selectedElement;
}

export function isExistingDraftElement(
  elements: Element[],
  draftElement: Element | null | undefined,
) {
  return elements.some((el) => el.id === draftElement?.id);
}

export function getMultiSelectBounds(
  elements: Element[],
  selectedIds: string[],
): MultiSelectBounds | null {
  if (selectedIds.length <= 1) return null;

  const selectedElements = elements.filter((el) => selectedIds.includes(el.id) && !el.isDeleted);
  if (selectedElements.length <= 1) return null;

  const xs = selectedElements.flatMap((el) => [el.x, el.x + el.width]);
  const ys = selectedElements.flatMap((el) => [el.y, el.y + el.height]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

export function getSnapIndicatorPoints(
  tool: ToolId,
  draftElement: Element | null | undefined,
  elements: Element[],
): Point[] {
  if (tool !== 'arrow' || !draftElement?.props.points || draftElement.props.points.length === 0) {
    return [];
  }

  const pts = draftElement.props.points;
  const endpoints = [
    { x: pts[0][0], y: pts[0][1] },
    { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] },
  ];

  return endpoints.flatMap((endpoint) => {
    const snap = findNearestSnap(endpoint, elements, draftElement.id);
    return snap ? [{ x: snap.x, y: snap.y }] : [];
  });
}
