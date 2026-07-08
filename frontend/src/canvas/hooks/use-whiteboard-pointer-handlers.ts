import { useRef, useState } from 'react';
import type React from 'react';
import type { Element, Camera } from '../../types/shared';
import type { HandleId, ToolId } from '../../types/interaction';
import { useCameraStore, useInteractionStore } from '../../store';
import { emitCursorMove } from '../../sync/socket-client';
import { PRESENCE_PREVIEW_THROTTLE_MS } from '../../sync/socket/p5-command-queue';
import {
  isShapeTool,
  onShapePointerDown,
  onShapePointerMove,
  onShapePointerUp,
} from '../tools/create-shape-tool';
import {
  onFreehandPointerDown,
  onFreehandPointerMove,
  onFreehandPointerUp,
  onHighlighterPointerDown,
  onHighlighterPointerMove,
  onHighlighterPointerUp,
} from '../tools/freehand-tool';
import { onEraserPointerDown, onEraserPointerMove, onEraserPointerUp } from '../tools/eraser-tool';
import { onLaserPointerMove } from '../tools/laser-tool';
import { onSelectPointerDown, onSelectPointerMove, onSelectPointerUp } from '../tools/select-tool';
import { svgWorldPoint } from '../pointer-coordinates';
import { useMultiTouchGesture } from './use-multi-touch-gesture';
import { resolveContextMenuState, type ContextMenuState } from './whiteboard-context-menu';
import { handleWhiteboardDoubleClick } from './whiteboard-double-click';
import { handleWhiteboardHandlePointerDown } from './whiteboard-handle-pointer';
import {
  cancelCurrentSinglePointerAction,
  cancelPointerOnLeave,
  cancelPointerWithoutCommit,
} from './whiteboard-pointer-cancel';

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

  const multiTouchGesture = useMultiTouchGesture({
    onGestureStart: (event) =>
      cancelCurrentSinglePointerAction(event, {
        camera,
        canEdit,
        panStart,
        setIsPanning,
        tool,
      }),
    setIsPanning,
  });

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (multiTouchGesture.handlePointerDown(event)) return;

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
      onSelectPointerDown(worldPoint, event.shiftKey, event.ctrlKey || event.metaKey);
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

    if (tool === 'highlighter') {
      event.currentTarget.setPointerCapture(event.pointerId);
      onHighlighterPointerDown(svgWorldPoint(event, camera));
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
    if (multiTouchGesture.handlePointerMove(event)) return;

    const now = Date.now();
    if (now - lastCursorSent.current >= PRESENCE_PREVIEW_THROTTLE_MS) {
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
      onSelectPointerMove(svgWorldPoint(event, camera), event.shiftKey);
      return;
    }

    if (!canEdit) return;

    if (tool === 'freehand') {
      onFreehandPointerMove(svgWorldPoint(event, camera));
      return;
    }

    if (tool === 'highlighter') {
      onHighlighterPointerMove(svgWorldPoint(event, camera));
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
    if (multiTouchGesture.handlePointerEnd(event)) return;

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

    if (tool === 'highlighter') {
      onHighlighterPointerUp(svgWorldPoint(event, camera));
      return;
    }

    if (tool === 'eraser') {
      onEraserPointerUp(svgWorldPoint(event, camera));
      return;
    }

    if (!isShapeTool(tool)) return;
    onShapePointerUp(tool, svgWorldPoint(event, camera));
  }

  function handlePointerLeave(event: React.PointerEvent<SVGSVGElement>) {
    if (multiTouchGesture.handlePointerEnd(event)) return;

    cancelPointerOnLeave({ camera, canEdit, panStart, setIsPanning, tool });
  }

  function handlePointerCancel(event: React.PointerEvent<SVGSVGElement>) {
    if (multiTouchGesture.handlePointerEnd(event)) return;

    cancelPointerWithoutCommit({ camera, canEdit, panStart, setIsPanning, tool });
  }

  function handleContextMenu(event: React.MouseEvent<SVGSVGElement>) {
    event.preventDefault();
    if (!canEdit) {
      setContextMenu(null);
      return;
    }

    setContextMenu(resolveContextMenuState(event, camera, elements));
  }

  function handleDoubleClick(event: React.MouseEvent<SVGSVGElement>) {
    handleWhiteboardDoubleClick({ canEdit, camera, editingId, elements, event, tool });
  }

  function handleHandlePointerDown(handle: HandleId, event: React.PointerEvent<SVGCircleElement>) {
    handleWhiteboardHandlePointerDown({ camera, canEdit, event, handle });
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
      onPointerCancel: handlePointerCancel,
      onDoubleClick: handleDoubleClick,
      onContextMenu: handleContextMenu,
      onHandlePointerDown: handleHandlePointerDown,
    },
  };
}
