import { beforeEach, describe, expect, it } from 'vitest';
import { useElementsStore } from '../../../../store/elements.store';
import { useInteractionStore } from '../../../../store/interaction.store';
import { onSelectAll } from '../select-all';
import { makeElement } from './test-utils';

beforeEach(() => {
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().reset();
});

describe('select all', () => {
  it('selects every non-deleted element', () => {
    const a = makeElement({ id: 'a' });
    const b = makeElement({ id: 'b' });
    const deleted = makeElement({ id: 'c', isDeleted: true });
    useElementsStore.getState().setElements([a, b, deleted]);

    onSelectAll();

    expect(useInteractionStore.getState().selectedIds).toEqual(['a', 'b']);
  });

  it('includes locked elements, matching marquee-select behavior', () => {
    const a = makeElement({ id: 'a', locked: true });
    useElementsStore.getState().setElements([a]);

    onSelectAll();

    expect(useInteractionStore.getState().selectedIds).toEqual(['a']);
  });

  it('is a no-op when the board is empty', () => {
    onSelectAll();
    expect(useInteractionStore.getState().selectedIds).toEqual([]);
  });
});
