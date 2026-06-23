import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useElementsStore, useInteractionStore, useCameraStore } from '../store';
import { screenToWorld } from '../utils/camera';
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
} from './tools/select-tool';
import SvgLayer from './layers/SvgLayer';
import Toolbar from '../components/toolbar/Toolbar';
import DetailPanel from '../components/detail-panel/DetailPanel';
import type { ResizeHandleId } from '../types/interaction';

function svgLocalPoint(e: React.PointerEvent) {
  const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

export default function Whiteboard() {
  const elements = useElementsStore((s) => s.elements);
  const camera = useCameraStore((s) => s.camera);
  const tool = useInteractionStore((s) => s.tool);
  const draftElement = useInteractionStore((s) => s.draftElement);

  // T001: refs and state for pan/zoom
  const containerRef = useRef<HTMLDivElement>(null);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  // T008: non-passive wheel listener for scroll-zoom (covers AC-1 – AC-4)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const { camera: cam, zoomTo } = useCameraStore.getState();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const rect = el!.getBoundingClientRect();
      zoomTo(cam.zoom * factor, { x: e.clientX - rect.left, y: e.clientY - rect.top });
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
    if (!isShapeTool(tool)) return;
    cancelShapeDraw();
  }

  function handleHandlePointerDown(
    handle: ResizeHandleId,
    e: React.PointerEvent<SVGCircleElement>,
  ) {
    const svgEl = e.currentTarget.closest('svg') as SVGSVGElement | null;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const worldPt = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, camera);
    onSelectHandlePointerDown(handle, worldPt);
  }

  // T023: cursor style based on pan/zoom mode
  const cursor = isPanning ? 'grabbing' : tool === 'hand' || spaceDown ? 'grab' : undefined;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', cursor }}
    >
      <SvgLayer
        elements={elements}
        camera={camera}
        draftElement={draftElement}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onHandlePointerDown={handleHandlePointerDown}
      />
      <Toolbar />
      <DetailPanel />
    </div>
  );
}
