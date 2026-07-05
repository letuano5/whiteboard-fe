import type React from 'react';
import type { Camera, Element } from '../../types/shared';
import { hitTestElementAtWorldPoint } from '../shapes/hit-test';
import { svgWorldPoint } from '../pointer-coordinates';

export interface ContextMenuState {
  x: number;
  y: number;
  id: string;
}

export function resolveContextMenuState(
  event: React.MouseEvent<SVGSVGElement>,
  camera: Camera,
  elements: Element[],
): ContextMenuState | null {
  const worldPoint = svgWorldPoint(event, camera);
  const visible = elements
    .filter((element) => !element.isDeleted)
    .sort((a, b) => b.zIndex - a.zIndex);

  for (const element of visible) {
    if (hitTestElementAtWorldPoint(element, worldPoint)) {
      return { x: event.clientX, y: event.clientY, id: element.id };
    }
  }

  return null;
}
