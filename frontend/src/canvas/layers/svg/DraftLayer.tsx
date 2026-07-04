import type React from 'react';
import { useMemo } from 'react';
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
  const renderElements = useMemo(
    () => mergeDraftElements(elements, draftElement, draftElements),
    [elements, draftElement, draftElements],
  );

  return (
    <>
      {draftElement && (
        <DraftElement
          element={draftElement}
          elements={renderElements}
          opacity={isEditingExistingElement ? 1 : 0.6}
        />
      )}
      {draftElements.map((draftEl) => (
        <DraftElement
          key={draftEl.id}
          element={draftEl}
          elements={renderElements}
          opacity={0.6}
          style={{ pointerEvents: 'none' }}
        />
      ))}
    </>
  );
}

interface DraftElementProps {
  element: Element;
  elements: Element[];
  opacity: number;
  style?: React.CSSProperties;
}

function DraftElement({ element, elements, opacity, style }: DraftElementProps) {
  const util = getShapeUtil(element.type);
  if (!util) return null;

  return (
    <g opacity={opacity} style={style}>
      {util.render(element, { elements })}
    </g>
  );
}

function mergeDraftElements(
  elements: Element[],
  draftElement: Element | null,
  draftElements: Element[],
): Element[] {
  if (!draftElement && draftElements.length === 0) return elements;

  const drafts = new Map<string, Element>();
  if (draftElement) drafts.set(draftElement.id, draftElement);
  for (const draft of draftElements) drafts.set(draft.id, draft);

  const merged = elements.map((element) => drafts.get(element.id) ?? element);
  const committedIds = new Set(elements.map((element) => element.id));
  for (const draft of drafts.values()) {
    if (!committedIds.has(draft.id)) merged.push(draft);
  }
  return merged;
}
