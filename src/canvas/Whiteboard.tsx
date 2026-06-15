import type React from 'react';
import { useElementsStore, useInteractionStore, useCameraStore } from '../store';
import { screenToWorld } from '../utils/camera';
import {
  isShapeTool,
  onShapePointerDown,
  onShapePointerMove,
  onShapePointerUp,
  cancelShapeDraw,
} from './tools/create-shape-tool';
import SvgLayer from './layers/SvgLayer';
import Toolbar from '../components/toolbar/Toolbar';

function svgLocalPoint(e: React.PointerEvent<SVGSVGElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

export default function Whiteboard() {
  const elements = useElementsStore((s) => s.elements);
  const camera = useCameraStore((s) => s.camera);
  const tool = useInteractionStore((s) => s.tool);
  const draftElement = useInteractionStore((s) => s.draftElement);

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!isShapeTool(tool)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const local = svgLocalPoint(e);
    onShapePointerDown(tool, screenToWorld(local.x, local.y, camera));
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!isShapeTool(tool)) return;
    const local = svgLocalPoint(e);
    onShapePointerMove(tool, screenToWorld(local.x, local.y, camera));
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (!isShapeTool(tool)) return;
    const local = svgLocalPoint(e);
    onShapePointerUp(tool, screenToWorld(local.x, local.y, camera));
  }

  function handlePointerLeave(_e: React.PointerEvent<SVGSVGElement>) {
    if (!isShapeTool(tool)) return;
    cancelShapeDraw();
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
      />
      <Toolbar />
    </div>
  );
}
