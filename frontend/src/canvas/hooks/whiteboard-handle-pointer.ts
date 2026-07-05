import type React from 'react';
import type { Camera } from '../../types/shared';
import type { HandleId } from '../../types/interaction';
import { onRotateHandlePointerDown, onSelectHandlePointerDown } from '../tools/select-tool';
import { svgElementWorldPoint } from '../pointer-coordinates';

interface HandlePointerParams {
  camera: Camera;
  canEdit: boolean;
  event: React.PointerEvent<SVGCircleElement>;
  handle: HandleId;
}

export function handleWhiteboardHandlePointerDown({
  camera,
  canEdit,
  event,
  handle,
}: HandlePointerParams): void {
  if (!canEdit) return;

  const svgElement = event.currentTarget.closest('svg') as SVGSVGElement | null;
  if (!svgElement) return;

  const worldPoint = svgElementWorldPoint(svgElement, event, camera);
  if (handle === 'rotate') {
    svgElement.setPointerCapture(event.pointerId);
    onRotateHandlePointerDown(worldPoint);
    return;
  }

  onSelectHandlePointerDown(handle, worldPoint);
}
