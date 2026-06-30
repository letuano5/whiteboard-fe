import { useMemo } from 'react';
import ElementLayer from './ElementLayer';
import DraftLayer from './DraftLayer';
import LaserTrailOverlay from './LaserTrailOverlay';
import MarqueeOverlay from './MarqueeOverlay';
import RemoteDraftLayer from './RemoteDraftLayer';
import RemoteSelectionOverlay from './RemoteSelectionOverlay';
import { MultiSelectionOverlay, SelectionOverlay } from './SelectionOverlay';
import SnapIndicators from './SnapIndicators';
import {
  getElementLookup,
  getMultiSelectBounds,
  getRemoteDraftElementLookup,
  getRemoteDraftLookup,
  getSelectedOverlayElement,
  getSnapIndicatorPoints,
  getVisibleElements,
  isExistingDraftElement,
} from './selectors';
import { useInteractionStore } from '../../../store/interaction.store';
import type { SvgLayerProps } from './types';

export default function SvgLayer({
  elements,
  camera,
  draftElement,
  editingId,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onDoubleClick,
  onContextMenu,
  onHandlePointerDown,
}: SvgLayerProps) {
  const selectedIds = useInteractionStore((s) => s.selectedIds);
  const laserTrail = useInteractionStore((s) => s.laserTrail);
  const laserFading = useInteractionStore((s) => s.laserFading);
  const marquee = useInteractionStore((s) => s.marquee);
  const draftElements = useInteractionStore((s) => s.draftElements);
  const remoteCursors = useInteractionStore((s) => s.remoteCursors);
  const remoteDrafts = useInteractionStore((s) => s.remoteDrafts);
  const tool = useInteractionStore((s) => s.tool);

  const elementsById = useMemo(() => getElementLookup(elements), [elements]);
  const remoteDraftsBySessionId = useMemo(() => getRemoteDraftLookup(remoteDrafts), [remoteDrafts]);
  const remoteDraftsByElementId = useMemo(
    () => getRemoteDraftElementLookup(remoteDrafts),
    [remoteDrafts],
  );
  const visibleElements = getVisibleElements(elements, draftElement, draftElements, remoteDrafts);
  const overlayElement = getSelectedOverlayElement(
    elementsById,
    selectedIds,
    draftElement,
    remoteDraftsByElementId,
  );
  const isEditingExistingElement = isExistingDraftElement(elements, draftElement);
  const multiSelectBounds = getMultiSelectBounds(elements, selectedIds);
  const snapIndicatorPoints = getSnapIndicatorPoints(tool, draftElement, elements);
  const canShowLocalSelection = !editingId && draftElements.length === 0;

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
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <g transform={`scale(${camera.zoom}) translate(${-camera.x} ${-camera.y})`}>
        <ElementLayer elements={visibleElements} editingId={editingId} />
        <RemoteDraftLayer remoteDrafts={remoteDrafts} remoteCursors={remoteCursors} />
        <DraftLayer
          draftElement={draftElement}
          draftElements={draftElements}
          isEditingExistingElement={isEditingExistingElement}
        />
        <RemoteSelectionOverlay
          elementsById={elementsById}
          remoteCursors={remoteCursors}
          remoteDraftsBySessionId={remoteDraftsBySessionId}
        />
        {overlayElement && canShowLocalSelection && (
          <SelectionOverlay element={overlayElement} onHandlePointerDown={onHandlePointerDown} />
        )}
        {multiSelectBounds && canShowLocalSelection && (
          <MultiSelectionOverlay bounds={multiSelectBounds} />
        )}
        <MarqueeOverlay marquee={marquee} />
        <LaserTrailOverlay laserTrail={laserTrail} laserFading={laserFading} />
        <SnapIndicators points={snapIndicatorPoints} />
      </g>
    </svg>
  );
}
