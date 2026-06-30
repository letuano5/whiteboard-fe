import type React from 'react';
import type { Element } from '../../../types/shared';
import { getShapeUtil } from '../../shapes';

interface DraftLayerProps {
  draftElement?: Element | null;
  draftElements: Element[];
  isEditingExistingElement: boolean;
}

export default function DraftLayer({
  draftElement,
  draftElements,
  isEditingExistingElement,
}: DraftLayerProps) {
  return (
    <>
      {draftElement && (
        <DraftElement element={draftElement} opacity={isEditingExistingElement ? 1 : 0.6} />
      )}
      {draftElements.map((draftEl) => (
        <DraftElement
          key={draftEl.id}
          element={draftEl}
          opacity={0.6}
          style={{ pointerEvents: 'none' }}
        />
      ))}
    </>
  );
}

interface DraftElementProps {
  element: Element;
  opacity: number;
  style?: React.CSSProperties;
}

function DraftElement({ element, opacity, style }: DraftElementProps) {
  const util = getShapeUtil(element.type);
  if (!util) return null;

  return (
    <g opacity={opacity} style={style}>
      {util.render(element)}
    </g>
  );
}
