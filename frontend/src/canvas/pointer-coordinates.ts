import type React from 'react';
import type { Camera } from '../types/shared';
import type { Point } from '../types/geometry';
import { screenToWorld } from '../utils/camera';

interface ClientPoint {
  clientX: number;
  clientY: number;
}

export type SvgPointerEvent = React.PointerEvent<SVGSVGElement>;
export type SvgMouseEvent = React.MouseEvent<SVGSVGElement>;

export function clientPointToLocalPoint(point: ClientPoint, rect: DOMRect): Point {
  return {
    x: point.clientX - rect.left,
    y: point.clientY - rect.top,
  };
}

export function svgLocalPoint(event: SvgPointerEvent | SvgMouseEvent): Point {
  return clientPointToLocalPoint(event, event.currentTarget.getBoundingClientRect());
}

export function svgWorldPoint(event: SvgPointerEvent | SvgMouseEvent, camera: Camera): Point {
  const local = svgLocalPoint(event);
  return screenToWorld(local.x, local.y, camera);
}

export function svgElementWorldPoint(
  svgElement: SVGSVGElement,
  point: ClientPoint,
  camera: Camera,
): Point {
  const local = clientPointToLocalPoint(point, svgElement.getBoundingClientRect());
  return screenToWorld(local.x, local.y, camera);
}
