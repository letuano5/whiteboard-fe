import { beforeEach, describe, expect, it } from 'vitest';
import type { Element } from '../../../types/shared';
import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import { onCopySelected, onDuplicateSelected, onPasteSelected } from '../select-tool';

function makeHighlighter(overrides: Partial<Element> = {}): Element {
  return {
    id: 'highlighter-1',
    type: 'highlighter',
    x: 10,
    y: 20,
    width: 50,
    height: 25,
    angle: 0,
    zIndex: 1,
    props: {
      strokeColor: '#facc15',
      fillColor: 'transparent',
      strokeWidth: 14,
      strokeStyle: 'solid',
      opacity: 0.35,
      points: [
        [10, 20],
        [30, 45],
        [60, 35],
      ],
    },
    version: 1,
    versionNonce: 123,
    updatedAt: Date.now(),
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
    ...overrides,
  };
}

beforeEach(() => {
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().reset();
});

describe('ink clipboard interactions', () => {
  it('duplicates highlighter strokes with offset point geometry', () => {
    const element = makeHighlighter();
    useElementsStore.getState().setElements([element]);
    useInteractionStore.getState().setSelectedIds([element.id]);

    onDuplicateSelected();

    const elements = useElementsStore.getState().elements;
    const duplicate = elements.find((candidate) => candidate.id !== element.id);
    expect(duplicate).toMatchObject({
      type: 'highlighter',
      x: 20,
      y: 30,
      width: 50,
      height: 25,
    });
    expect(duplicate?.props.points).toEqual([
      [20, 30],
      [40, 55],
      [70, 45],
    ]);
    expect(useInteractionStore.getState().selectedIds).toEqual([duplicate?.id]);
  });

  it('copies and pastes highlighter strokes with increasing point offsets', () => {
    const element = makeHighlighter();
    useElementsStore.getState().setElements([element]);
    useInteractionStore.getState().setSelectedIds([element.id]);

    onCopySelected();
    onPasteSelected();
    onPasteSelected();

    const elements = useElementsStore.getState().elements;
    const pasted = elements.filter((candidate) => candidate.id !== element.id);
    expect(pasted).toHaveLength(2);
    expect(pasted[0]?.props.points).toEqual([
      [20, 30],
      [40, 55],
      [70, 45],
    ]);
    expect(pasted[1]?.props.points).toEqual([
      [30, 40],
      [50, 65],
      [80, 55],
    ]);
    expect(pasted.every((candidate) => candidate.type === 'highlighter')).toBe(true);
  });
});
