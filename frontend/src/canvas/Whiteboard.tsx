import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useElementsStore, useInteractionStore, useCameraStore, useHistoryStore } from '../store';
import { screenToWorld, ZOOM_SENSITIVITY } from '../utils/camera';
import {
  isShapeTool,
  onShapePointerDown,
  onShapePointerMove,
  onShapePointerUp,
  cancelShapeDraw,
} from './tools/create-shape-tool';
import {
  onSelectPointerDown,
  onSelectHandlePointerDown,
  onSelectPointerMove,
  onSelectPointerUp,
  onSelectKeyDown,
  onRotateHandlePointerDown,
} from './tools/select-tool';
import TextEditor, { onCanvasDoubleClick } from './tools/text-editor';
import { onLaserPointerMove, onLaserPointerLeave } from './tools/laser-tool';
import SvgLayer from './layers/SvgLayer';
import Toolbar from '../components/toolbar/Toolbar';
import DetailPanel from '../components/detail-panel/DetailPanel';
import BackToContent from '../components/back-to-content/BackToContent';
import ShareLinkButton from '../components/ShareLinkButton';
import type { HandleId } from '../types/interaction';

function svgLocalPoint(e: React.PointerEvent) {
  const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

export default function Whiteboard() {
  const elements = useElementsStore((s) => s.elements);
  const camera = useCameraStore((s) => s.camera);
  const tool = useInteractionStore((s) => s.tool);
  const draftElement = useInteractionStore((s) => s.draftElement);
  const editingId = useInteractionStore((s) => s.editingId);
  const editingElement = editingId
    ? elements.find((el) => el.id === editingId && !el.isDeleted) ?? null
    : null;

  // T001: refs and state for pan/zoom
  const containerRef = useRef<HTMLDivElement>(null);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  // T008/T013: non-passive wheel listener — pan or zoom based on ctrlKey (AC-6, AC-7, AC-8, AC-12)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const { camera: cam, zoomTo, panBy } = useCameraStore.getState();

      // Normalize delta for LINE/PAGE modes (AC-12)
      const normY =
        e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * rect.height : e.deltaY;
      const normX =
        e.deltaMode === 1 ? e.deltaX * 16 : e.deltaMode === 2 ? e.deltaX * rect.width : e.deltaX;

      if (e.ctrlKey || e.metaKey) {
        // Zoom: trackpad pinch (browser sets ctrlKey=true) or Ctrl/Cmd + wheel (AC-7)
        // Smooth sensitivity via exp formula (AC-8): ZOOM_SENSITIVITY = 0.001
        const factor = Math.exp(-normY * ZOOM_SENSITIVITY);
        zoomTo(cam.zoom * factor, { x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else {
        // Two-finger scroll → pan (AC-6)
        panBy(normX / cam.zoom, normY / cam.zoom);
      }
    }
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // T021: Space key → temporary pan mode (covers AC-10 – AC-12)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      )
        return;
      e.preventDefault();
      setSpaceDown(true);
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') setSpaceDown(false);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Select-tool keyboard shortcuts
  useEffect(() => {
    if (tool !== 'select') return;
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }
      onSelectKeyDown(e.key);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tool]);

  // Undo / Redo — active in all tool modes (AC-15: guard text inputs)
  useEffect(() => {
    function handleUndoRedo(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      )
        return;
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useHistoryStore.getState().undo();
      } else if (e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        useHistoryStore.getState().redo();
      }
    }
    window.addEventListener('keydown', handleUndoRedo);
    return () => window.removeEventListener('keydown', handleUndoRedo);
  }, []);

  // T002/T003: pan trigger helper — checked FIRST in every pointer handler
  function isPanTrigger(e: React.PointerEvent) {
    return tool === 'hand' || e.button === 1 || spaceDown;
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    // T003: pan check BEFORE the SVGElement guard (covers AC-5, AC-8, AC-10)
    if (isPanTrigger(e)) {
      panStart.current = { x: e.clientX, y: e.clientY };
      setIsPanning(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (tool === 'laser') {
      e.currentTarget.setPointerCapture(e.pointerId);
      const local = svgLocalPoint(e);
      onLaserPointerMove(screenToWorld(local.x, local.y, camera));
      return;
    }

    if (!(e.target instanceof SVGElement)) return;
    if (tool === 'select') {
      const local = svgLocalPoint(e);
      onSelectPointerDown(screenToWorld(local.x, local.y, camera));
      if (useInteractionStore.getState().draggingId) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }
    if (!isShapeTool(tool)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const local = svgLocalPoint(e);
    onShapePointerDown(tool, screenToWorld(local.x, local.y, camera));
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    // T013: pan move (covers AC-5, AC-8, AC-10)
    if (panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      const { camera: cam, panBy } = useCameraStore.getState();
      panBy(-dx / cam.zoom, -dy / cam.zoom);
      panStart.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (tool === 'laser') {
      const local = svgLocalPoint(e);
      onLaserPointerMove(screenToWorld(local.x, local.y, camera));
      return;
    }

    if (tool === 'select') {
      const local = svgLocalPoint(e);
      onSelectPointerMove(screenToWorld(local.x, local.y, camera));
      return;
    }
    if (!isShapeTool(tool)) return;
    const local = svgLocalPoint(e);
    onShapePointerMove(tool, screenToWorld(local.x, local.y, camera));
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    // T014: stop pan on pointer up (covers AC-6, AC-9, AC-11)
    if (panStart.current) {
      panStart.current = null;
      setIsPanning(false);
      return;
    }

    if (tool === 'laser') {
      return;
    }

    if (tool === 'select') {
      const local = svgLocalPoint(e);
      onSelectPointerUp(screenToWorld(local.x, local.y, camera));
      return;
    }
    if (!isShapeTool(tool)) return;
    const local = svgLocalPoint(e);
    onShapePointerUp(tool, screenToWorld(local.x, local.y, camera));
  }

  function handlePointerLeave(_e: React.PointerEvent<SVGSVGElement>) {
    // T014: defensive fallback — pointer capture normally prevents this during active pan
    if (panStart.current) {
      panStart.current = null;
      setIsPanning(false);
      return;
    }
    if (tool === 'laser') {
      onLaserPointerLeave();
      return;
    }
    if (!isShapeTool(tool)) return;
    cancelShapeDraw();
  }

  function handleDoubleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (tool !== 'select') return;
    if (editingId) return;
    const { draggingId, isRotating, resizeSession } = useInteractionStore.getState();
    if (draggingId || isRotating || resizeSession) return;
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const local = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    onCanvasDoubleClick(screenToWorld(local.x, local.y, camera));
  }

  function handleHandlePointerDown(
    handle: HandleId,
    e: React.PointerEvent<SVGCircleElement>,
  ) {
    const svgEl = e.currentTarget.closest('svg') as SVGSVGElement | null;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const worldPt = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, camera);
    if (handle === 'rotate') {
      svgEl.setPointerCapture(e.pointerId);
      onRotateHandlePointerDown(worldPt);
    } else {
      onSelectHandlePointerDown(handle, worldPt);
    }
  }

  // T023: cursor style based on pan/zoom mode
  const cursor = isPanning
    ? 'grabbing'
    : tool === 'hand' || spaceDown
      ? 'grab'
      : tool === 'laser'
        ? 'crosshair'
        : undefined;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', cursor }}
    >
      <SvgLayer
        elements={elements}
        camera={camera}
        draftElement={draftElement}
        editingId={editingId}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onDoubleClick={handleDoubleClick}
        onHandlePointerDown={handleHandlePointerDown}
      />
      {editingElement && (
        <TextEditor element={editingElement} camera={camera} />
      )}
      <Toolbar />
      <DetailPanel />
      <BackToContent containerRef={containerRef} />
      <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 50 }}>
        <ShareLinkButton />
      </div>
      {tool === 'select' && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            fontSize: '12px',
            color: '#aaa',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          Click chuột giữa để scroll canvas
        </div>
      )}
    </div>
  );
}
