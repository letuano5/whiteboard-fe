import { beforeEach, describe, expect, it } from 'vitest';
import { useElementsStore } from '../../../../store/elements.store';
import { useInteractionStore } from '../../../../store/interaction.store';
import { onCutSelected, onPasteSelected } from '../clipboard';
import { makeElement } from './test-utils';

beforeEach(() => {
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().reset();
});

describe('cut selected', () => {
  it('copies then soft-deletes the selection, clearing the selection', () => {
    const a = makeElement({ id: 'a' });
    useElementsStore.getState().setElements([a]);
    useInteractionStore.getState().setSelectedIds(['a']);

    onCutSelected();

    const stored = useElementsStore.getState().elements.find((el) => el.id === 'a');
    expect(stored?.isDeleted).toBe(true);
    expect(useInteractionStore.getState().selectedIds).toEqual([]);
    expect(useInteractionStore.getState().clipboard).toHaveLength(1);
  });

  it('lets a cut element be pasted back afterwards', () => {
    const a = makeElement({ id: 'a', x: 5, y: 5 });
    useElementsStore.getState().setElements([a]);
    useInteractionStore.getState().setSelectedIds(['a']);

    onCutSelected();
    onPasteSelected();

    const pasted = useElementsStore.getState().elements.find((el) => !el.isDeleted);
    expect(pasted).toMatchObject({ x: 15, y: 15 });
  });

  it('does nothing when nothing is selected', () => {
    const a = makeElement({ id: 'a' });
    useElementsStore.getState().setElements([a]);

    onCutSelected();

    expect(useElementsStore.getState().elements[0].isDeleted).toBe(false);
    expect(useInteractionStore.getState().clipboard).toBeNull();
  });
});
