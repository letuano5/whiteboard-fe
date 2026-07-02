import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '../../../types/shared';
import type { ElementDraft, MutationEvent } from '../../../store/mutation-pipeline';
import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import { createElement, registerMutationHook } from '../../../store/mutation-pipeline';
import { useHistoryStore } from '../../../store/history.store';
import { initHistoryCapture } from '../../../sync/history-capture';
import {
  cancelEraserDrag,
  findEraserHitIds,
  onEraserPointerDown,
  onEraserPointerMove,
  onEraserPointerUp,
} from '../eraser-tool';

const BASE_PROPS = {
  strokeColor: '#111827',
  fillColor: 'transparent',
  strokeWidth: 3,
  strokeStyle: 'solid' as const,
  opacity: 1,
};

beforeEach(() => {
  useElementsStore.setState({ elements: [] });
  useHistoryStore.setState({ undoStack: [], redoStack: [], isApplying: false });
  useInteractionStore.getState().reset();
  cancelEraserDrag();
  vi.restoreAllMocks();
});

function makeDraft(overrides: Partial<ElementDraft> = {}): ElementDraft {
  return {
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 20,
    height: 20,
    angle: 0,
    props: BASE_PROPS,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
    ...overrides,
  };
}

describe('eraser tool', () => {
  // @covers AC-1
  it('soft-deletes a visible shape when a drag passes through it', () => {
    const element = createElement(makeDraft());

    onEraserPointerDown({ x: -10, y: 10 });
    onEraserPointerMove({ x: 30, y: 10 });
    onEraserPointerUp({ x: 30, y: 10 });

    const updated = useElementsStore.getState().elements.find((el) => el.id === element.id);
    expect(updated?.isDeleted).toBe(true);
  });

  // @covers AC-2
  it('emits a delete mutation event through the shared mutation pipeline', () => {
    const events: MutationEvent[] = [];
    const unregister = registerMutationHook((event) => events.push(event));
    const element = createElement(makeDraft());

    onEraserPointerDown({ x: 10, y: 10 });
    onEraserPointerUp({ x: 10, y: 10 });
    unregister();

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'delete',
          elements: [expect.objectContaining({ id: element.id, isDeleted: true })],
          before: [expect.objectContaining({ id: element.id, isDeleted: false })],
        }),
      ]),
    );
  });

  // @covers AC-3
  it('uses a segment sweep between pointer samples with registered shape hit testing', () => {
    const line = createElement(
      makeDraft({
        type: 'line',
        x: 0,
        y: 0,
        width: 100,
        height: 0,
        props: {
          ...BASE_PROPS,
          points: [
            [0, 0],
            [100, 0],
          ],
        },
      }),
    );

    const hits = findEraserHitIds([line], { x: 50, y: -30 }, { x: 50, y: 30 });

    expect(hits).toEqual([line.id]);
  });

  // @covers AC-4
  it('deletes an entire ink stroke instead of splitting its points', () => {
    const highlighter = createElement(
      makeDraft({
        type: 'highlighter',
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        props: {
          ...BASE_PROPS,
          strokeWidth: 14,
          opacity: 0.35,
          points: [
            [0, 0],
            [50, 20],
            [100, 0],
          ],
        },
      }),
    );

    onEraserPointerDown({ x: 50, y: 20 });
    onEraserPointerUp({ x: 50, y: 20 });

    const updated = useElementsStore
      .getState()
      .elements.find((element): element is Element => element.id === highlighter.id);
    expect(updated?.isDeleted).toBe(true);
    expect(updated?.props.points).toEqual(highlighter.props.points);
  });

  // @covers AC-5
  it('can undo an eraser delete through the history store', () => {
    const unregisterHistory = initHistoryCapture();
    const element = createElement(makeDraft());
    useHistoryStore.setState({ undoStack: [], redoStack: [], isApplying: false });

    onEraserPointerDown({ x: 10, y: 10 });
    onEraserPointerUp({ x: 10, y: 10 });
    expect(useElementsStore.getState().elements.find((el) => el.id === element.id)?.isDeleted).toBe(
      true,
    );

    useHistoryStore.getState().undo();

    expect(useElementsStore.getState().elements.find((el) => el.id === element.id)?.isDeleted).toBe(
      false,
    );
    unregisterHistory();
  });
});
