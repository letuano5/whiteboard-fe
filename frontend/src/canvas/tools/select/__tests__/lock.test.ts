import { beforeEach, describe, expect, it } from 'vitest';
import { useElementsStore } from '../../../../store/elements.store';
import { useInteractionStore } from '../../../../store/interaction.store';
import { canToggleLockSelection, isSelectionLocked, onToggleLockSelected } from '../lock';
import { makeElement } from './test-utils';

beforeEach(() => {
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().reset();
});

describe('lock toggle', () => {
  it('locks every selected element in one batch when none are locked yet', () => {
    const a = makeElement({ id: 'a', locked: false });
    const b = makeElement({ id: 'b', locked: false });
    useElementsStore.getState().setElements([a, b]);
    useInteractionStore.getState().setSelectedIds(['a', 'b']);

    expect(canToggleLockSelection([a, b], ['a', 'b'])).toBe(true);
    expect(isSelectionLocked([a, b], ['a', 'b'])).toBe(false);

    onToggleLockSelected();

    const locked = useElementsStore.getState().elements.map((el) => el.locked);
    expect(locked).toEqual([true, true]);
  });

  it('unlocks when every selected element is already locked', () => {
    const a = makeElement({ id: 'a', locked: true });
    const b = makeElement({ id: 'b', locked: true });
    useElementsStore.getState().setElements([a, b]);
    useInteractionStore.getState().setSelectedIds(['a', 'b']);

    expect(isSelectionLocked([a, b], ['a', 'b'])).toBe(true);

    onToggleLockSelected();

    const locked = useElementsStore.getState().elements.map((el) => el.locked);
    expect(locked).toEqual([false, false]);
  });

  it('a mixed locked/unlocked selection locks everything on the next toggle', () => {
    const a = makeElement({ id: 'a', locked: true });
    const b = makeElement({ id: 'b', locked: false });
    useElementsStore.getState().setElements([a, b]);
    useInteractionStore.getState().setSelectedIds(['a', 'b']);

    expect(isSelectionLocked([a, b], ['a', 'b'])).toBe(false);

    onToggleLockSelected();

    const locked = useElementsStore.getState().elements.map((el) => el.locked);
    expect(locked).toEqual([true, true]);
  });

  it('is disabled when nothing is selected', () => {
    const a = makeElement({ id: 'a' });
    expect(canToggleLockSelection([a], [])).toBe(false);
  });
});
