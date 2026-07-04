import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as PipelineModule from '../../../../store/mutation-pipeline';
import { useElementsStore } from '../../../../store/elements.store';
import { useInteractionStore } from '../../../../store/interaction.store';
import {
  canMergeSelection,
  canUnmergeSelection,
  onMergeSelected,
  onUnmergeSelected,
} from '../merge';
import { makeElement } from './test-utils';

const updateElementsSpy = vi.fn();

vi.mock('../../../../store/mutation-pipeline', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof PipelineModule;
  return {
    ...actual,
    updateElements: (...args: Parameters<(typeof PipelineModule)['updateElements']>) => {
      updateElementsSpy(...args);
      return actual.updateElements(...args);
    },
  };
});

beforeEach(() => {
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().reset();
  updateElementsSpy.mockClear();
});

describe('merge commands', () => {
  it('@covers AC-1 assigns one shared groupId to 2+ selected non-locked elements', () => {
    const a = makeElement({ id: 'a' });
    const b = makeElement({ id: 'b' });
    useElementsStore.getState().setElements([a, b]);
    useInteractionStore.getState().setSelectedIds(['a', 'b']);

    expect(canMergeSelection([a, b], ['a', 'b'])).toBe(true);
    onMergeSelected();

    const groupIds = useElementsStore.getState().elements.map((el) => el.groupId);
    expect(groupIds[0]).toBeTruthy();
    expect(groupIds[0]).toBe(groupIds[1]);
    expect(updateElementsSpy).toHaveBeenCalledOnce();
  });

  it('@covers AC-1 refuses merge when fewer than two selected elements are selectable', () => {
    const a = makeElement({ id: 'a' });
    const b = makeElement({ id: 'b', locked: true });
    expect(canMergeSelection([a, b], ['a', 'b'])).toBe(false);
  });

  it('@covers AC-2 clears groupId from every member of the selected group', () => {
    const a = makeElement({ id: 'a', groupId: 'g' });
    const b = makeElement({ id: 'b', groupId: 'g' });
    useElementsStore.getState().setElements([a, b]);
    useInteractionStore.getState().setSelectedIds(['a']);

    expect(canUnmergeSelection([a, b], ['a'])).toBe(true);
    onUnmergeSelected();

    expect(useElementsStore.getState().elements.map((el) => el.groupId)).toEqual([null, null]);
    expect(updateElementsSpy).toHaveBeenCalledOnce();
  });

  it('@covers AC-3 joins one existing group and flattens two existing groups into a new id', () => {
    const joined = [makeElement({ id: 'a', groupId: 'g' }), makeElement({ id: 'b' })];
    useElementsStore.getState().setElements(joined);
    useInteractionStore.getState().setSelectedIds(['a', 'b']);
    onMergeSelected();
    expect(useElementsStore.getState().elements.map((el) => el.groupId)).toEqual(['g', 'g']);

    const flattened = [
      makeElement({ id: 'a', groupId: 'g1' }),
      makeElement({ id: 'b', groupId: 'g2' }),
    ];
    useElementsStore.getState().setElements(flattened);
    updateElementsSpy.mockClear();
    onMergeSelected();
    const groupIds = useElementsStore.getState().elements.map((el) => el.groupId);
    expect(groupIds[0]).toBe(groupIds[1]);
    expect(groupIds[0]).not.toBe('g1');
    expect(groupIds[0]).not.toBe('g2');
  });

  it('@covers AC-4 @covers AC-5 binds exactly one text and one container but leaves plain groups alone', () => {
    const box = makeElement({
      id: 'box',
      type: 'rectangle',
      x: 10,
      y: 20,
      width: 120,
      height: 80,
      zIndex: 3,
    });
    const text = makeElement({
      id: 'text',
      type: 'text',
      props: { ...makeElement().props, text: 'Alpha Bravo', fontSize: 10 },
      zIndex: 1,
    });
    useElementsStore.getState().setElements([box, text]);
    useInteractionStore.getState().setSelectedIds(['box', 'text']);
    onMergeSelected();

    const boundText = useElementsStore.getState().elements.find((el) => el.id === 'text')!;
    expect(boundText.props.textAlign).toBe('center');
    expect(boundText.zIndex).toBe(box.zIndex + 1);
    expect(boundText.x).toBeGreaterThan(box.x);

    const secondBox = makeElement({ id: 'box-2', type: 'ellipse' });
    useElementsStore.getState().setElements([box, secondBox, text]);
    useInteractionStore.getState().setSelectedIds(['box', 'box-2', 'text']);
    onMergeSelected();
    const plainText = useElementsStore.getState().elements.find((el) => el.id === 'text')!;
    expect(plainText.zIndex).toBe(text.zIndex);
  });
});
