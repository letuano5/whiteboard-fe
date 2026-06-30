import type React from 'react';
import type { Element, Presence } from '../../../types/shared';

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
        const peerDraftIds = new Set((remoteDrafts.get(peer.sessionId) ?? []).map((el) => el.id));

        return peer.selectedIds
          .map((elementId) => {
            if (peerDraftIds.has(elementId)) return null;

            const element = elements.find((el) => el.id === elementId && !el.isDeleted);
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
  return (
    <rect
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      fill="none"
      stroke={peerColor}
      strokeWidth={1.5}
      style={{ pointerEvents: 'none' }}
    />
  );
}
