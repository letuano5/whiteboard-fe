import type React from 'react';
import type { Element } from '../../../types/shared';
import { useInteractionStore } from '../../../store/interaction.store';
import { getShapeUtil } from '../../shapes';

interface DraftLayerProps {
  elements: Element[];
}

export default function DraftLayer({ elements }: DraftLayerProps) {
  const draftElement = useInteractionStore((s) => s.draftElement);
  const draftElements = useInteractionStore((s) => s.draftElements);
  const draftElementId = draftElement?.id ?? null;
  const isEditingExistingElement = elements.some((el) => el.id === draftElementId);

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
