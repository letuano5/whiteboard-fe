import type { Element } from '../../../types/shared';
import type { Point } from '../../../types/geometry';
import type { ToolId } from '../../../types/interaction';
import { findNearestSnap } from '../../shapes/arrow-binding';
import type { MultiSelectBounds } from './types';

export type ElementLookup = Map<string, Element>;
export type RemoteDraftLookup = Map<string, ElementLookup>;

export function getElementLookup(elements: Element[]): ElementLookup {
  const lookup: ElementLookup = new Map();

  for (const element of elements) {
    if (!element.isDeleted) lookup.set(element.id, element);
  }

  return lookup;
}

export function getRemoteDraftLookup(remoteDrafts: Map<string, Element[]>): RemoteDraftLookup {
  const lookup: RemoteDraftLookup = new Map();

  for (const [sessionId, draftElements] of remoteDrafts) {
    lookup.set(sessionId, getElementLookup(draftElements));
  }

  return lookup;
}

export function getRemoteDraftElementLookup(remoteDrafts: Map<string, Element[]>): ElementLookup {
  const lookup: ElementLookup = new Map();

  for (const draftElements of remoteDrafts.values()) {
    for (const draftElement of draftElements) {
      if (!draftElement.isDeleted && !lookup.has(draftElement.id)) {
        lookup.set(draftElement.id, draftElement);
      }
    }
  }

  return lookup;
}

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
  elementsById: ElementLookup,
  selectedIds: string[],
  draftElement: Element | null | undefined,
  remoteDraftsByElementId: ElementLookup = new Map(),
) {
  if (selectedIds.length !== 1) return null;

  const selectedElement = elementsById.get(selectedIds[0]);
  if (!selectedElement) return null;

  if (draftElement?.id === selectedElement.id) return draftElement;

  return remoteDraftsByElementId.get(selectedElement.id) ?? selectedElement;
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
