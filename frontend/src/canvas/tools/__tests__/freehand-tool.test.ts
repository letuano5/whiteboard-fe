import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import {
  deleteElements,
  patchElement,
  registerMutationHook,
  type MutationEvent,
} from '../../../store/mutation-pipeline';
import {
  MAX_POINTS_PER_FREEHAND_STROKE,
  splitFreehandStrokeAtCap,
} from '../../freehand-points';
import {
  cancelFreehandDraw,
  onFreehandPointerDown,
  onFreehandPointerMove,
  onFreehandPointerUp,
} from '../freehand-tool';

beforeEach(() => {
  useElementsStore.setState({ elements: [] });
  useInteractionStore.getState().reset();
  cancelFreehandDraw();
  vi.restoreAllMocks();
});

function point(index: number) {
  return { x: index, y: index % 2 === 0 ? 0 : 20 };
}

describe('freehand tool', () => {
  // @covers AC-1
  it('commits a freehand element through the mutation pipeline with props.points', () => {
    const events: MutationEvent[] = [];
    const unregister = registerMutationHook((event) => events.push(event));

    onFreehandPointerDown({ x: 0, y: 0 });
    onFreehandPointerMove({ x: 10, y: 20 });
    onFreehandPointerUp({ x: 20, y: 0 });
    unregister();

    const [element] = useElementsStore.getState().elements;
    expect(element).toMatchObject({
      type: 'freehand',
      x: 0,
      y: 0,
      height: 20,
      isDeleted: false,
    });
    expect(element.props.points).toEqual([
      [0, 0],
      [10, 20],
      [20, 0],
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'create', elements: [element], before: [] });
  });

  // @covers AC-1
  it('resulting freehand elements can be moved and deleted through shared mutations', () => {
    onFreehandPointerDown({ x: 0, y: 0 });
    onFreehandPointerMove({ x: 10, y: 20 });
    onFreehandPointerUp({ x: 20, y: 0 });

    const element = useElementsStore.getState().elements[0];
    patchElement(element.id, {
      x: 5,
      y: 5,
      props: {
        ...element.props,
        points: element.props.points?.map(([x, y]) => [x + 5, y + 5]),
      },
    });
    deleteElements([element.id]);

    const updated = useElementsStore.getState().elements[0];
    expect(updated.props.points).toEqual([
      [5, 5],
      [15, 25],
      [25, 5],
    ]);
    expect(updated.isDeleted).toBe(true);
  });

  // @covers AC-3
  it('splits a long drag into multiple freehand elements at the point cap', () => {
    onFreehandPointerDown(point(0));
    for (let index = 1; index <= MAX_POINTS_PER_FREEHAND_STROKE; index += 1) {
      onFreehandPointerMove(point(index));
    }
    onFreehandPointerUp(point(MAX_POINTS_PER_FREEHAND_STROKE + 1));

    const elements = useElementsStore.getState().elements;
    expect(elements).toHaveLength(2);
    expect(elements.every((element) => element.type === 'freehand')).toBe(true);
    expect(
      elements.every(
        (element) => (element.props.points?.length ?? 0) <= MAX_POINTS_PER_FREEHAND_STROKE,
      ),
    ).toBe(true);
    expect(elements[0].props.points?.at(-1)).toEqual(elements[1].props.points?.[0]);
  });
});

describe('freehand point cap helper', () => {
  // @covers AC-3
  it('returns a committed capped stroke and a bridged active stroke', () => {
    const points = [
      [0, 0],
      [1, 10],
      [2, 0],
      [3, 10],
    ] satisfies [number, number][];

    expect(splitFreehandStrokeAtCap(points, 3)).toEqual({
      committed: [
        [0, 0],
        [1, 10],
        [2, 0],
      ],
      active: [
        [2, 0],
        [3, 10],
      ],
    });
  });
});
