import type React from 'react';
import type { Element, Presence } from '../../../types/shared';
import ElementOutline from './ElementOutline';
import type { ElementLookup, RemoteDraftLookup } from './selectors';

interface RemoteSelectionOverlayProps {
  elementsById: ElementLookup;
  remoteCursors: Map<string, Presence>;
  remoteDraftsBySessionId: RemoteDraftLookup;
}

export default function RemoteSelectionOverlay({
  elementsById,
  remoteCursors,
  remoteDraftsBySessionId,
}: RemoteSelectionOverlayProps) {
  return (
    <>
      {Array.from(remoteCursors.values()).flatMap((peer) => {
        const peerDraftsById = remoteDraftsBySessionId.get(peer.sessionId);

        return peer.selectedIds
          .map((elementId) => {
            const element = peerDraftsById?.get(elementId) ?? elementsById.get(elementId);
            if (!element) return null;

            return (
              <RemoteSelectionRect
                key={`remote-sel-${peer.sessionId}-${elementId}`}
                element={element}
                peerColor={peer.color}
              />
            );
          })
          .filter((node): node is React.ReactElement => node !== null);
      })}
    </>
  );
}

interface RemoteSelectionRectProps {
  element: Element;
  peerColor: string;
}

function RemoteSelectionRect({ element, peerColor }: RemoteSelectionRectProps) {
  return <ElementOutline element={element} stroke={peerColor} strokeWidth={1.5} />;
}
