import { useMemo } from 'react';
import ElementLayer from './ElementLayer';
import DraftLayer from './DraftLayer';
import LaserTrailOverlay from './LaserTrailOverlay';
import LocalSelectionLayer from './LocalSelectionLayer';
import MarqueeOverlay from './MarqueeOverlay';
import RemoteDraftLayer from './RemoteDraftLayer';
import RemoteSelectionOverlay from './RemoteSelectionOverlay';
import SnapIndicatorLayer from './SnapIndicatorLayer';
import { getElementLookup, getRemoteDraftLookup } from './selectors';
import { useInteractionStore } from '../../../store/interaction.store';
import type { SvgLayerProps } from './types';

export default function SvgLayer({
  elements,
  camera,
  editingId,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onDoubleClick,
  onContextMenu,
  onHandlePointerDown,
}: SvgLayerProps) {
  const laserTrail = useInteractionStore((s) => s.laserTrail);
  const laserFading = useInteractionStore((s) => s.laserFading);
  const marquee = useInteractionStore((s) => s.marquee);
  const remoteCursors = useInteractionStore((s) => s.remoteCursors);
  const remoteDrafts = useInteractionStore((s) => s.remoteDrafts);

  const elementsById = useMemo(() => getElementLookup(elements), [elements]);
  const remoteDraftsBySessionId = useMemo(() => getRemoteDraftLookup(remoteDrafts), [remoteDrafts]);

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <g transform={`scale(${camera.zoom}) translate(${-camera.x} ${-camera.y})`}>
        <ElementLayer elements={elements} editingId={editingId} />
        <RemoteDraftLayer remoteDrafts={remoteDrafts} remoteCursors={remoteCursors} />
        <DraftLayer elements={elements} />
        <RemoteSelectionOverlay
          elementsById={elementsById}
          remoteCursors={remoteCursors}
          remoteDraftsBySessionId={remoteDraftsBySessionId}
        />
        <LocalSelectionLayer
          elementsById={elementsById}
          editingId={editingId}
          onHandlePointerDown={onHandlePointerDown}
        />
        <MarqueeOverlay marquee={marquee} />
        <LaserTrailOverlay laserTrail={laserTrail} laserFading={laserFading} />
        <SnapIndicatorLayer elements={elements} />
      </g>
    </svg>
  );
}
