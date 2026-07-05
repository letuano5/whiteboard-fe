import { beforeEach, describe, expect, it } from 'vitest';
import { useElementsStore } from '../../../../store/elements.store';
import { useInteractionStore } from '../../../../store/interaction.store';
import { onSelectHandlePointerDown } from '../pointer-down';
import { onSelectPointerMove } from '../pointer-move';
import { makeElement } from './test-utils';

beforeEach(() => {
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().reset();
});

describe('Shift-resize locks aspect ratio — single element', () => {
  it('without Shift, width/height change independently', () => {
    const el = makeElement({ id: 'rect', x: 10, y: 10, width: 100, height: 50 });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);
    onSelectHandlePointerDown('se', { x: 110, y: 60 });

    onSelectPointerMove({ x: 140, y: 80 });

    expect(useInteractionStore.getState().draftElement).toMatchObject({
      x: 10,
      y: 10,
      width: 130,
      height: 70,
    });
  });

  it('with Shift held, resize scales uniformly around the anchor, preserving aspect ratio', () => {
    const el = makeElement({ id: 'rect', x: 10, y: 10, width: 100, height: 50 });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);
    onSelectHandlePointerDown('se', { x: 110, y: 60 });

    onSelectPointerMove({ x: 140, y: 80 }, true);

    // scale = max(130/100, 70/50) = 1.4 -> width 140, height 70, anchored at (10, 10)
    expect(useInteractionStore.getState().draftElement).toMatchObject({
      x: 10,
      y: 10,
      width: 140,
      height: 70,
    });
  });

  it('locks aspect ratio for a rotated element too', () => {
    const el = makeElement({ id: 'rect-rot', x: 10, y: 10, width: 100, height: 50, angle: 0.5 });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds([el.id]);
    onSelectHandlePointerDown('se', { x: 110, y: 60 });

    onSelectPointerMove({ x: 140, y: 80 }, true);

    // Rotation reprojects the pointer into local space before resizing, so the
    // absolute size differs from the non-rotated case — only the aspect ratio
    // (originally 100:50 = 2:1) is guaranteed to be preserved.
    const draft = useInteractionStore.getState().draftElement;
    expect((draft?.width ?? 0) / (draft?.height ?? 1)).toBeCloseTo(2);
  });
});

describe('Shift-resize locks aspect ratio — group resize', () => {
  it('scales every member uniformly on both axes when Shift is held', () => {
    const a = makeElement({ id: 'a', groupId: 'g', x: 0, y: 0, width: 50, height: 50 });
    const b = makeElement({ id: 'b', groupId: 'g', x: 50, y: 0, width: 50, height: 50 });
    useElementsStore.getState().setElements([a, b]);
    useInteractionStore.getState().setSelectedIds(['a', 'b']);
    onSelectHandlePointerDown('se', { x: 100, y: 50 });

    onSelectPointerMove({ x: 160, y: 70 }, true);

    const drafts = useInteractionStore.getState().draftElements;
    // scale = max(160/100, 70/50) = 1.6 applied uniformly -> both squares stay square
    expect(drafts.find((el) => el.id === 'a')).toMatchObject({ x: 0, y: 0, width: 80, height: 80 });
    expect(drafts.find((el) => el.id === 'b')).toMatchObject({
      x: 80,
      y: 0,
      width: 80,
      height: 80,
    });
  });

  it('without Shift, group members can be scaled non-uniformly', () => {
    const a = makeElement({ id: 'a', groupId: 'g', x: 0, y: 0, width: 50, height: 50 });
    const b = makeElement({ id: 'b', groupId: 'g', x: 50, y: 0, width: 50, height: 50 });
    useElementsStore.getState().setElements([a, b]);
    useInteractionStore.getState().setSelectedIds(['a', 'b']);
    onSelectHandlePointerDown('se', { x: 100, y: 50 });

    onSelectPointerMove({ x: 160, y: 70 });

    const drafts = useInteractionStore.getState().draftElements;
    const draftA = drafts.find((el) => el.id === 'a');
    expect(draftA?.width).not.toBe(draftA?.height);
  });
});
