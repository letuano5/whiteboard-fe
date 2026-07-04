import { beforeEach, describe, expect, it } from 'vitest';
import { useElementsStore } from '../../../../store/elements.store';
import { useInteractionStore } from '../../../../store/interaction.store';
import { onCopySelected, onDuplicateSelected, onPasteSelected } from '../clipboard';
import { makeElement } from './test-utils';

beforeEach(() => {
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().reset();
});

describe('clipboard group remap', () => {
  it('@covers AC-11 duplicates one source group with one fresh shared groupId', () => {
    useElementsStore
      .getState()
      .setElements([
        makeElement({ id: 'a', groupId: 'g' }),
        makeElement({ id: 'b', groupId: 'g' }),
      ]);
    useInteractionStore.getState().setSelectedIds(['a', 'b']);

    onDuplicateSelected();

    const copies = useElementsStore.getState().elements.filter((el) => !['a', 'b'].includes(el.id));
    expect(copies).toHaveLength(2);
    expect(copies[0].groupId).toBe(copies[1].groupId);
    expect(copies[0].groupId).not.toBe('g');
  });

  it('@covers AC-11 duplicates different source groups with distinct fresh ids', () => {
    useElementsStore
      .getState()
      .setElements([
        makeElement({ id: 'a', groupId: 'g1' }),
        makeElement({ id: 'b', groupId: 'g2' }),
      ]);
    useInteractionStore.getState().setSelectedIds(['a', 'b']);

    onDuplicateSelected();

    const copies = useElementsStore.getState().elements.filter((el) => !['a', 'b'].includes(el.id));
    expect(copies[0].groupId).not.toBe(copies[1].groupId);
    expect(copies.map((el) => el.groupId)).not.toContain('g1');
    expect(copies.map((el) => el.groupId)).not.toContain('g2');
  });

  it('@covers AC-11 keeps ungrouped pasted elements ungrouped', () => {
    useElementsStore.getState().setElements([makeElement({ id: 'a' })]);
    useInteractionStore.getState().setSelectedIds(['a']);

    onCopySelected();
    onPasteSelected();

    const copy = useElementsStore.getState().elements.find((el) => el.id !== 'a');
    expect(copy?.groupId).toBeNull();
  });
});
