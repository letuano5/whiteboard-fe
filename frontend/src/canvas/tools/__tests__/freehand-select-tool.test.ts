import { beforeEach, describe, expect, it } from 'vitest';
import type { Element } from '../../../types/shared';
import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import {
  onRotateHandlePointerDown,
  onSelectHandlePointerDown,
  onSelectPointerDown,
  onSelectPointerMove,
  onSelectPointerUp,
} from '../select-tool';

function makeInk(overrides: Partial<Element> = {}): Element {
  return {
    id: 'freehand-1',
    type: 'freehand',
    x: 10,
    y: 20,
    width: 50,
    height: 25,
    angle: 0,
    zIndex: 1,
    props: {
      strokeColor: '#2563eb',
      fillColor: 'transparent',
      strokeWidth: 4,
      strokeStyle: 'solid',
      opacity: 1,
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

function makeFreehand(overrides: Partial<Element> = {}): Element {
  return makeInk(overrides);
}

function makeHighlighter(overrides: Partial<Element> = {}): Element {
  return makeInk({
    id: 'highlighter-1',
    type: 'highlighter',
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
    ...overrides,
  });
}

beforeEach(() => {
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().reset();
});

describe('freehand select interactions', () => {
  // @covers AC-4
  it('moves freehand point geometry through the select tool', () => {
    const element = makeFreehand();
    useElementsStore.getState().setElements([element]);

    onSelectPointerDown({ x: 30, y: 45 });
    onSelectPointerMove({ x: 35, y: 50 });
    onSelectPointerUp({ x: 35, y: 50 });

    const updated = useElementsStore.getState().elements[0];
    expect(updated).toMatchObject({ x: 15, y: 25, width: 50, height: 25 });
    expect(updated.props.points).toEqual([
      [15, 25],
      [35, 50],
      [65, 40],
    ]);
    expect(updated.version).toBe(2);
  });

  // @covers AC-4
  it('resizes freehand point geometry through resize handles', () => {
    const element = makeFreehand();
    useElementsStore.getState().setElements([element]);
    useInteractionStore.getState().setSelectedIds([element.id]);

    onSelectHandlePointerDown('se', { x: 60, y: 45 });
    onSelectPointerMove({ x: 110, y: 70 });
    onSelectPointerUp({ x: 110, y: 70 });

    const updated = useElementsStore.getState().elements[0];
    expect(updated).toMatchObject({ x: 10, y: 20, width: 100, height: 50 });
    expect(updated.props.points).toEqual([
      [10, 20],
      [50, 70],
      [110, 50],
    ]);
  });

  // @covers AC-4
  it('commits freehand rotation through the select tool', () => {
    const element = makeFreehand();
    useElementsStore.getState().setElements([element]);
    useInteractionStore.getState().setSelectedIds([element.id]);

    onRotateHandlePointerDown({ x: 35, y: -4 });
    onSelectPointerMove({ x: 120, y: 32.5 });
    onSelectPointerUp({ x: 120, y: 32.5 });

    const updated = useElementsStore.getState().elements[0];
    expect(updated.angle).toBeCloseTo(Math.PI / 2, 2);
    expect(updated.props.points).toEqual(element.props.points);
  });
});

describe('highlighter select interactions', () => {
  it('moves highlighter point geometry through the select tool', () => {
    const element = makeHighlighter();
    useElementsStore.getState().setElements([element]);

    onSelectPointerDown({ x: 30, y: 45 });
    onSelectPointerMove({ x: 35, y: 50 });
    onSelectPointerUp({ x: 35, y: 50 });

    const updated = useElementsStore.getState().elements[0];
    expect(updated).toMatchObject({ x: 15, y: 25, width: 50, height: 25 });
    expect(updated.props.points).toEqual([
      [15, 25],
      [35, 50],
      [65, 40],
    ]);
    expect(updated.props.opacity).toBe(0.35);
  });

  it('resizes highlighter point geometry through resize handles', () => {
    const element = makeHighlighter();
    useElementsStore.getState().setElements([element]);
    useInteractionStore.getState().setSelectedIds([element.id]);

    onSelectHandlePointerDown('se', { x: 60, y: 45 });
    onSelectPointerMove({ x: 110, y: 70 });
    onSelectPointerUp({ x: 110, y: 70 });

    const updated = useElementsStore.getState().elements[0];
    expect(updated).toMatchObject({ x: 10, y: 20, width: 100, height: 50 });
    expect(updated.props.points).toEqual([
      [10, 20],
      [50, 70],
      [110, 50],
    ]);
  });

  it('commits highlighter rotation through the select tool', () => {
    const element = makeHighlighter();
    useElementsStore.getState().setElements([element]);
    useInteractionStore.getState().setSelectedIds([element.id]);

    onRotateHandlePointerDown({ x: 35, y: -4 });
    onSelectPointerMove({ x: 120, y: 32.5 });
    onSelectPointerUp({ x: 120, y: 32.5 });

    const updated = useElementsStore.getState().elements[0];
    expect(updated.angle).toBeCloseTo(Math.PI / 2, 2);
    expect(updated.props.points).toEqual(element.props.points);
  });
});
