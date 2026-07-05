import type React from 'react';
import type { MutableRefObject } from 'react';
import type { Camera } from '../../types/shared';
import type { ToolId } from '../../types/interaction';
import { useInteractionStore } from '../../store';
import { cancelShapeDraw, isShapeTool } from '../tools/create-shape-tool';
import { cancelEraserDrag } from '../tools/eraser-tool';
import { cancelFreehandDraw, cancelHighlighterDraw } from '../tools/freehand-tool';
import { onLaserPointerLeave } from '../tools/laser-tool';
import { onSelectPointerUp } from '../tools/select-tool';
import { svgWorldPoint } from '../pointer-coordinates';

interface PointerCancelParams {
  camera: Camera;
  canEdit: boolean;
  panStart: MutableRefObject<{ x: number; y: number } | null>;
  setIsPanning: (value: boolean) => void;
  tool: ToolId;
}

function clearPanState({ panStart, setIsPanning }: PointerCancelParams) {
  if (!panStart.current) return;
  panStart.current = null;
  setIsPanning(false);
}

function clearSelectTransientInteraction() {
  const {
    setDraggingId,
    setDragStart,
    setDraftElement,
    setDraftElements,
    setMarquee,
    setResizeHandle,
    setResizeSession,
    setGroupResizeSession,
    setIsRotating,
  } = useInteractionStore.getState();

  setDraggingId(null);
  setDragStart(null);
  setDraftElement(null);
  setDraftElements([]);
  setMarquee(null);
  setResizeHandle(null);
  setResizeSession(null);
  setGroupResizeSession(null);
  setIsRotating(false);
}

export function cancelCurrentSinglePointerAction(
  event: React.PointerEvent<SVGSVGElement>,
  params: PointerCancelParams,
): void {
  clearPanState(params);
  if (!params.canEdit) return;

  if (params.tool === 'select') {
    onSelectPointerUp(svgWorldPoint(event, params.camera));
    return;
  }

  if (params.tool === 'freehand') {
    cancelFreehandDraw();
    return;
  }

  if (params.tool === 'highlighter') {
    cancelHighlighterDraw();
    return;
  }

  if (params.tool === 'eraser') {
    cancelEraserDrag();
    return;
  }

  if (isShapeTool(params.tool)) cancelShapeDraw();
}

export function cancelPointerWithoutCommit(params: PointerCancelParams): void {
  clearPanState(params);
  if (!params.canEdit) return;

  if (params.tool === 'laser') {
    onLaserPointerLeave();
    return;
  }

  if (params.tool === 'select') {
    clearSelectTransientInteraction();
    return;
  }

  if (params.tool === 'freehand') {
    cancelFreehandDraw();
    return;
  }

  if (params.tool === 'highlighter') {
    cancelHighlighterDraw();
    return;
  }

  if (params.tool === 'eraser') {
    cancelEraserDrag();
    return;
  }

  if (isShapeTool(params.tool)) cancelShapeDraw();
}

export function cancelPointerOnLeave(params: PointerCancelParams): void {
  clearPanState(params);
  if (!params.canEdit) return;

  if (params.tool === 'laser') {
    onLaserPointerLeave();
    return;
  }

  if (params.tool === 'freehand') {
    cancelFreehandDraw();
    return;
  }

  if (params.tool === 'highlighter') {
    cancelHighlighterDraw();
    return;
  }

  if (params.tool === 'eraser') {
    cancelEraserDrag();
    return;
  }

  if (isShapeTool(params.tool)) cancelShapeDraw();
}
