import type { Element, Presence } from '../../../types/shared';
import { getShapeUtil } from '../../shapes';
import ElementOutline from './ElementOutline';

interface RemoteDraftLayerProps {
  remoteDrafts: Map<string, Element[]>;
  remoteCursors: Map<string, Presence>;
}

export default function RemoteDraftLayer({ remoteDrafts, remoteCursors }: RemoteDraftLayerProps) {
  return (
    <>
      {Array.from(remoteDrafts.entries()).flatMap(([sessionId, draftEls]) => {
        const peer = remoteCursors.get(sessionId);
        const peerColor = peer?.color ?? '#888888';

        return draftEls.map((draftEl) => (
          <RemoteDraftElement
            key={`remote-draft-${sessionId}-${draftEl.id}`}
            element={draftEl}
            peerColor={peerColor}
          />
        ));
      })}
    </>
  );
}

interface RemoteDraftElementProps {
  element: Element;
  peerColor: string;
}

function RemoteDraftElement({ element, peerColor }: RemoteDraftElementProps) {
  const util = getShapeUtil(element.type);
  if (!util) return null;

  return (
    <g opacity={0.5} style={{ pointerEvents: 'none' }}>
      {util.render(element)}
      <ElementOutline element={element} stroke={peerColor} strokeWidth={1} />
    </g>
  );
}
