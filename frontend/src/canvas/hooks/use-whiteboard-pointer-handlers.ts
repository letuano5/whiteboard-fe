import { useRef, useState } from 'react';
import type React from 'react';
import type { Element, Camera } from '../../types/shared';
import type { HandleId, ToolId } from '../../types/interaction';
import { useCameraStore, useInteractionStore } from '../../store';
import { emitCursorMove } from '../../sync/socket-client';
import {
  cancelShapeDraw,
  isShapeTool,
  onShapePointerDown,
  onShapePointerMove,
  onShapePointerUp,
} from '../tools/create-shape-tool';
import {
  cancelFreehandDraw,
  onFreehandPointerDown,
  onFreehandPointerMove,
  onFreehandPointerUp,
} from '../tools/freehand-tool';
import {
  cancelEraserDrag,
  onEraserPointerDown,
  onEraserPointerMove,
  onEraserPointerUp,
} from '../tools/eraser-tool';
import { onLaserPointerLeave, onLaserPointerMove } from '../tools/laser-tool';
import {
  onRotateHandlePointerDown,
  onSelectHandlePointerDown,
  onSelectPointerDown,
  onSelectPointerMove,
  onSelectPointerUp,
} from '../tools/select-tool';
import { onCanvasDoubleClick } from '../tools/text-editor';
import { hitTestElementAtWorldPoint } from '../shapes/hit-test';
import { svgElementWorldPoint, svgWorldPoint } from '../pointer-coordinates';

interface ContextMenuState {
  x: number;
  y: number;
  id: string;
}

interface UseWhiteboardPointerHandlersParams {
  canEdit?: boolean;
  camera: Camera;
  elements: Element[];
  editingId: string | null;
  spaceDown: boolean;
  tool: ToolId;
}

export function useWhiteboardPointerHandlers({
  canEdit = true,
  camera,
  elements,
  editingId,
  spaceDown,
  tool,
}: UseWhiteboardPointerHandlersParams) {
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const lastCursorSent = useRef<number>(0);
  const [isPanning, setIsPanning] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  function isPanTrigger(event: React.PointerEvent) {
    return tool === 'hand' || event.button === 1 || spaceDown;
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (isPanTrigger(event)) {
      panStart.current = { x: event.clientX, y: event.clientY };
      setIsPanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (!canEdit) return;

    if (tool === 'laser') {
      event.currentTarget.setPointerCapture(event.pointerId);
      onLaserPointerMove(svgWorldPoint(event, camera));
      return;
    }

    if (!(event.target instanceof SVGElement)) return;

    if (tool === 'select') {
      const worldPoint = svgWorldPoint(event, camera);
      onSelectPointerDown(worldPoint, event.shiftKey);
      const state = useInteractionStore.getState();
      if (state.draggingId || state.marquee !== null) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      return;
    }

    if (tool === 'freehand') {
      event.currentTarget.setPointerCapture(event.pointerId);
      onFreehandPointerDown(svgWorldPoint(event, camera));
      return;
    }

    if (tool === 'eraser') {
      event.currentTarget.setPointerCapture(event.pointerId);
      onEraserPointerDown(svgWorldPoint(event, camera));
      return;
    }

    if (!isShapeTool(tool)) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    onShapePointerDown(tool, svgWorldPoint(event, camera));
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const now = Date.now();
    if (now - lastCursorSent.current >= 33) {
      emitCursorMove(svgWorldPoint(event, camera));
      lastCursorSent.current = now;
    }

    if (panStart.current) {
      const dx = event.clientX - panStart.current.x;
      const dy = event.clientY - panStart.current.y;
      const { camera: currentCamera, panBy } = useCameraStore.getState();
      panBy(-dx / currentCamera.zoom, -dy / currentCamera.zoom);
      panStart.current = { x: event.clientX, y: event.clientY };
      return;
    }

    if (tool === 'laser') {
      if (!canEdit) return;
      onLaserPointerMove(svgWorldPoint(event, camera));
      return;
    }

    if (tool === 'select') {
      if (!canEdit) return;
      onSelectPointerMove(svgWorldPoint(event, camera));
      return;
    }

    if (!canEdit) return;

    if (tool === 'freehand') {
      onFreehandPointerMove(svgWorldPoint(event, camera));
      return;
    }

    if (tool === 'eraser') {
      onEraserPointerMove(svgWorldPoint(event, camera));
      return;
    }

    if (!isShapeTool(tool)) return;
    onShapePointerMove(tool, svgWorldPoint(event, camera));
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (panStart.current) {
      panStart.current = null;
      setIsPanning(false);
      return;
    }

    if (!canEdit) return;

    if (tool === 'laser') return;

    if (tool === 'select') {
      onSelectPointerUp(svgWorldPoint(event, camera));
      return;
    }

    if (tool === 'freehand') {
      onFreehandPointerUp(svgWorldPoint(event, camera));
      return;
    }

    if (tool === 'eraser') {
      onEraserPointerUp(svgWorldPoint(event, camera));
      return;
    }

    if (!isShapeTool(tool)) return;
    onShapePointerUp(tool, svgWorldPoint(event, camera));
  }

  function handlePointerLeave() {
    if (panStart.current) {
      panStart.current = null;
      setIsPanning(false);
      return;
    }

    if (!canEdit) return;

    if (tool === 'laser') {
      onLaserPointerLeave();
      return;
    }

    if (tool === 'freehand') {
      cancelFreehandDraw();
      return;
    }

    if (tool === 'eraser') {
      cancelEraserDrag();
      return;
    }

    if (!isShapeTool(tool)) return;
    cancelShapeDraw();
  }

  function handleContextMenu(event: React.MouseEvent<SVGSVGElement>) {
    event.preventDefault();
    if (!canEdit) {
      setContextMenu(null);
      return;
    }

    const worldPoint = svgWorldPoint(event, camera);
    const visible = elements
      .filter((element) => !element.isDeleted)
      .sort((a, b) => b.zIndex - a.zIndex);

    for (const element of visible) {
      if (hitTestElementAtWorldPoint(element, worldPoint)) {
        setContextMenu({ x: event.clientX, y: event.clientY, id: element.id });
        return;
      }
    }

    setContextMenu(null);
  }

  function handleDoubleClick(event: React.MouseEvent<SVGSVGElement>) {
    if (!canEdit) return;
    if (tool !== 'select') return;
    if (editingId) return;

    const { draggingId, isRotating, resizeSession } = useInteractionStore.getState();
    if (draggingId || isRotating || resizeSession) return;

    onCanvasDoubleClick(svgWorldPoint(event, camera));
  }

  function handleHandlePointerDown(handle: HandleId, event: React.PointerEvent<SVGCircleElement>) {
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

  return {
    contextMenu,
    isPanning,
    onCloseContextMenu: () => setContextMenu(null),
    svgLayerHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerLeave: handlePointerLeave,
      onDoubleClick: handleDoubleClick,
      onContextMenu: handleContextMenu,
      onHandlePointerDown: handleHandlePointerDown,
    },
  };
}
