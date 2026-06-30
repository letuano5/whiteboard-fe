import type React from 'react';
import type { Element, Presence } from '../../../types/shared';
import ElementOutline from './ElementOutline';

interface RemoteSelectionOverlayProps {
  elements: Element[];
  remoteCursors: Map<string, Presence>;
  remoteDrafts: Map<string, Element[]>;
}

export default function RemoteSelectionOverlay({
  elements,
  remoteCursors,
  remoteDrafts,
}: RemoteSelectionOverlayProps) {
  return (
    <>
      {Array.from(remoteCursors.values()).flatMap((peer) => {
        const peerDrafts = remoteDrafts.get(peer.sessionId) ?? [];

        return peer.selectedIds
          .map((elementId) => {
            const element =
              peerDrafts.find((draftEl) => draftEl.id === elementId && !draftEl.isDeleted) ??
              elements.find((el) => el.id === elementId && !el.isDeleted);
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
