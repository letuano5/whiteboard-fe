import { memo, useMemo } from 'react';
import type { Element, ElementType } from '../../../types/shared';
import { useInteractionStore } from '../../../store/interaction.store';
import { getShapeUtil } from '../../shapes';

const warnedUnknownTypes = new Set<ElementType>();

interface ElementLayerProps {
  elements: Element[];
  editingId?: string | null;
}

function getHiddenDraftIdsKey({
  draftElement,
  draftElements,
  remoteDrafts,
}: Pick<
  ReturnType<typeof useInteractionStore.getState>,
  'draftElement' | 'draftElements' | 'remoteDrafts'
>): string {
  const ids = new Set<string>();

  if (draftElement?.id) ids.add(draftElement.id);
  for (const draft of draftElements) ids.add(draft.id);
  for (const drafts of remoteDrafts.values()) {
    for (const draft of drafts) ids.add(draft.id);
  }

  return Array.from(ids).sort().join('\n');
}

function ElementLayer({ elements, editingId }: ElementLayerProps) {
  const hiddenDraftIdsKey = useInteractionStore(getHiddenDraftIdsKey);
  const hiddenDraftIds = useMemo(
    () => new Set(hiddenDraftIdsKey ? hiddenDraftIdsKey.split('\n') : []),
    [hiddenDraftIdsKey],
  );
  const visibleElements = useMemo(
    () =>
      elements
        .filter((el) => !el.isDeleted && !hiddenDraftIds.has(el.id))
        .sort((a, b) => a.zIndex - b.zIndex),
    [elements, hiddenDraftIds],
  );

  return (
    <>
      {visibleElements.map((el) => (
        <CommittedElement
          key={el.id}
          element={el}
          elements={elements}
          isEditing={el.id === editingId}
        />
      ))}
    </>
  );
}

interface CommittedElementProps {
  element: Element;
  elements: Element[];
  isEditing: boolean;
}

const CommittedElement = memo(function CommittedElement({
  element,
  elements,
  isEditing,
}: CommittedElementProps) {
  const util = getShapeUtil(element.type);
  if (!util) {
    if (!warnedUnknownTypes.has(element.type)) {
      warnedUnknownTypes.add(element.type);
      console.warn(`[ElementLayer] No ShapeUtil registered for element type "${element.type}".`);
    }
    return null;
  }

  return <g opacity={isEditing ? 0 : undefined}>{util.render(element, { elements })}</g>;
});

export default memo(ElementLayer);
