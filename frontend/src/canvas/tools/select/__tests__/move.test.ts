import { beforeEach, describe, expect, it } from 'vitest';
import { useElementsStore } from '../../../../store/elements.store';
import { useInteractionStore } from '../../../../store/interaction.store';
import { onMoveSelected } from '../move';
import { makeElement } from './test-utils';

beforeEach(() => {
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().reset();
});

describe('arrow-key move', () => {
  it('does nothing when nothing is selected', () => {
    const a = makeElement({ id: 'a', x: 0, y: 0 });
    useElementsStore.getState().setElements([a]);

    onMoveSelected(1, 0);

    expect(useElementsStore.getState().elements[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('moves a single selected element by dx/dy', () => {
    const a = makeElement({ id: 'a', x: 10, y: 10 });
    useElementsStore.getState().setElements([a]);
    useInteractionStore.getState().setSelectedIds(['a']);

    onMoveSelected(1, -10);

    expect(useElementsStore.getState().elements[0]).toMatchObject({ x: 11, y: 0 });
  });

  it('moves a locked single element, matching mouse-drag behavior', () => {
    const a = makeElement({ id: 'a', x: 0, y: 0, locked: true });
    useElementsStore.getState().setElements([a]);
    useInteractionStore.getState().setSelectedIds(['a']);

    onMoveSelected(5, 5);

    expect(useElementsStore.getState().elements[0]).toMatchObject({ x: 5, y: 5 });
  });

  it('moves every plain multi-selected element together', () => {
    const a = makeElement({ id: 'a', x: 0, y: 0 });
    const b = makeElement({ id: 'b', x: 20, y: 20 });
    useElementsStore.getState().setElements([a, b]);
    useInteractionStore.getState().setSelectedIds(['a', 'b']);

    onMoveSelected(-1, 0);

    const elements = useElementsStore.getState().elements;
    expect(elements.find((el) => el.id === 'a')).toMatchObject({ x: -1, y: 0 });
    expect(elements.find((el) => el.id === 'b')).toMatchObject({ x: 19, y: 20 });
  });

  it('moves every non-locked member of a full merged-group selection', () => {
    const a = makeElement({ id: 'a', groupId: 'g', x: 0, y: 0 });
    const b = makeElement({ id: 'b', groupId: 'g', x: 20, y: 20 });
    const locked = makeElement({ id: 'locked', groupId: 'g', locked: true, x: 40, y: 40 });
    useElementsStore.getState().setElements([a, b, locked]);
    useInteractionStore.getState().setSelectedIds(['a', 'b', 'locked']);

    onMoveSelected(10, 10);

    const elements = useElementsStore.getState().elements;
    expect(elements.find((el) => el.id === 'a')).toMatchObject({ x: 10, y: 10 });
    expect(elements.find((el) => el.id === 'b')).toMatchObject({ x: 30, y: 30 });
    expect(elements.find((el) => el.id === 'locked')).toMatchObject({ x: 40, y: 40 });
  });

  it('translates point geometry for a freehand element', () => {
    const freehand = makeElement({
      id: 'ink',
      type: 'freehand',
      x: 0,
      y: 0,
      props: {
        ...makeElement().props,
        points: [
          [0, 0],
          [10, 10],
        ],
      },
    });
    useElementsStore.getState().setElements([freehand]);
    useInteractionStore.getState().setSelectedIds(['ink']);

    onMoveSelected(2, 3);

    const moved = useElementsStore.getState().elements[0];
    expect(moved.props.points).toEqual([
      [2, 3],
      [12, 13],
    ]);
  });
});
