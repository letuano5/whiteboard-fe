import type React from 'react';
import { useEffect } from 'react';
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

  useEffect(() => {
    if (tool !== 'select') return;
    function handleKeyDown(e: KeyboardEvent) {
      onSelectKeyDown(e.key);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tool]);

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
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
    </div>
  );
}
