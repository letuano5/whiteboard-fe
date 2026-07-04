import type React from 'react';
import { useMemo } from 'react';
import { useInteractionStore } from '../../../store/interaction.store';
import {
  getMultiSelectBounds,
  getRemoteDraftElementLookup,
  getSelectedOverlayElement,
  type ElementLookup,
} from './selectors';
import { GroupSelectionOverlay, MultiSelectionOverlay, SelectionOverlay } from './SelectionOverlay';
import type { HandleId } from '../../../types/interaction';
import { resolveSelectionGroupIds } from '../../tools/select/group';

interface LocalSelectionLayerProps {
  elementsById: ElementLookup;
  editingId?: string | null;
  onHandlePointerDown?: (handle: HandleId, e: React.PointerEvent<SVGCircleElement>) => void;
}

export default function LocalSelectionLayer({
  elementsById,
  editingId,
  onHandlePointerDown,
}: LocalSelectionLayerProps) {
  const selectedIds = useInteractionStore((s) => s.selectedIds);
  const draftElement = useInteractionStore((s) => s.draftElement);
  const draftElementsLength = useInteractionStore((s) => s.draftElements.length);
  const remoteDrafts = useInteractionStore((s) => s.remoteDrafts);
  const remoteDraftsByElementId = useMemo(
    () => getRemoteDraftElementLookup(remoteDrafts),
    [remoteDrafts],
  );
  const overlayElement = getSelectedOverlayElement(
    elementsById,
    selectedIds,
    draftElement,
    remoteDraftsByElementId,
  );
  const multiSelectBounds = getMultiSelectBounds(Array.from(elementsById.values()), selectedIds);
  const groupMemberIds = resolveSelectionGroupIds(selectedIds, Array.from(elementsById.values()));
  const isGroupSelection = groupMemberIds !== null;
  const canShowLocalSelection = !editingId && draftElementsLength === 0;

  return (
    <>
      {overlayElement && canShowLocalSelection && (
        <SelectionOverlay element={overlayElement} onHandlePointerDown={onHandlePointerDown} />
      )}
      {multiSelectBounds && canShowLocalSelection && isGroupSelection && (
        <GroupSelectionOverlay
          bounds={multiSelectBounds}
          onHandlePointerDown={onHandlePointerDown}
        />
      )}
      {multiSelectBounds && canShowLocalSelection && !isGroupSelection && (
        <MultiSelectionOverlay bounds={multiSelectBounds} />
      )}
    </>
  );
}
