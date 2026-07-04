import { beforeEach, describe, expect, it } from 'vitest';
import { useElementsStore } from '../../../../store/elements.store';
import { useInteractionStore } from '../../../../store/interaction.store';
import { onMergeSelected } from '../merge';
import { onSelectPointerDown } from '../pointer-down';
import { onSelectPointerMove } from '../pointer-move';
import { onSelectPointerUp } from '../pointer-up';
import { computeBoundContainerCascade, computeGroupDragDrafts } from '../group-drag';
import { makeElement } from './test-utils';

beforeEach(() => {
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().reset();
});

describe('group drag and bound text cascade', () => {
  it('@covers AC-6 moves a bound text by container delta and relayouts on resize', () => {
    const container = makeElement({ id: 'box', groupId: 'g', x: 0, y: 0, width: 100, height: 60 });
    const text = makeElement({
      id: 'text',
      type: 'text',
      groupId: 'g',
      x: 20,
      y: 20,
      width: 40,
      height: 12,
      props: { ...makeElement().props, text: 'Label', fontSize: 10 },
    });

    expect(
      computeBoundContainerCascade({ ...container, x: 10, y: 15 }, [container, text])[0],
    ).toMatchObject({
      id: 'text',
      x: 30,
      y: 35,
    });

    const resized = computeBoundContainerCascade({ ...container, width: 160, height: 80 }, [
      container,
      text,
    ])[0];
    expect(resized.width).toBe(144);
    expect(resized.props.textAlign).toBe('center');
  });

  it('@covers AC-8 moves every non-locked group member and keeps locked members still', () => {
    const elements = [
      makeElement({ id: 'a', groupId: 'g', x: 0, y: 0 }),
      makeElement({ id: 'b', groupId: 'g', x: 20, y: 20 }),
      makeElement({ id: 'locked', groupId: 'g', locked: true, x: 40, y: 40 }),
    ];

    const drafts = computeGroupDragDrafts(['a', 'b', 'locked'], 5, 7, elements);
    expect(drafts.find((el) => el.id === 'a')).toMatchObject({ x: 5, y: 7 });
    expect(drafts.find((el) => el.id === 'b')).toMatchObject({ x: 25, y: 27 });
    expect(drafts.find((el) => el.id === 'locked')).toBeUndefined();
  });

  it('@covers AC-8 commits a marquee-selected merged group when the pointer is released', () => {
    const a = makeElement({ id: 'a', x: 0, y: 0, width: 20, height: 20, zIndex: 1 });
    const b = makeElement({ id: 'b', x: 40, y: 0, width: 20, height: 20, zIndex: 2 });
    useElementsStore.getState().setElements([a, b]);

    onSelectPointerDown({ x: -10, y: -10 });
    onSelectPointerMove({ x: 70, y: 30 });
    onSelectPointerUp({ x: 70, y: 30 });
    expect(useInteractionStore.getState().selectedIds).toEqual(['a', 'b']);

    onMergeSelected();
    const merged = useElementsStore.getState().elements;
    expect(merged[0].groupId).toBeTruthy();
    expect(merged[0].groupId).toBe(merged[1].groupId);

    onSelectPointerDown({ x: 10, y: 10 });
    onSelectPointerMove({ x: 30, y: 40 });
    onSelectPointerUp({ x: 30, y: 40 });

    const updated = useElementsStore.getState().elements;
    expect(updated.find((el) => el.id === 'a')).toMatchObject({ x: 20, y: 30 });
    expect(updated.find((el) => el.id === 'b')).toMatchObject({ x: 60, y: 30 });
    expect(useInteractionStore.getState().draftElements).toEqual([]);
    expect(useInteractionStore.getState().draggingId).toBeNull();
  });
});
