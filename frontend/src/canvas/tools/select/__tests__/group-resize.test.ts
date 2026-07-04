import { beforeEach, describe, expect, it } from 'vitest';
import { useElementsStore } from '../../../../store/elements.store';
import { useInteractionStore } from '../../../../store/interaction.store';
import {
  WS_EVENTS,
  ELEMENT_FIELD_SYNC_CLASSIFICATION,
  ELEMENT_PROPS_FIELD_SYNC_CLASSIFICATION,
} from '../../../../types/shared';
import { computeGroupResizeDrafts } from '../group-resize';
import { onSelectPointerUp } from '../pointer-up';
import { makeElement } from './test-utils';

beforeEach(() => {
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().reset();
});

describe('group resize', () => {
  it('@covers AC-9 scales non-text, relayouts bound text, and leaves independent fontSize alone', () => {
    const container = makeElement({ id: 'box', groupId: 'g', x: 0, y: 0, width: 100, height: 50 });
    const boundText = makeElement({
      id: 'label',
      type: 'text',
      groupId: 'g',
      props: { ...makeElement().props, text: 'Label', fontSize: 12 },
    });
    const independentText = makeElement({
      id: 'note',
      type: 'text',
      groupId: 'plain',
      x: 50,
      y: 50,
      props: { ...makeElement().props, text: 'Note', fontSize: 20 },
    });
    const locked = makeElement({ id: 'locked', groupId: 'locked-group', locked: true });

    const drafts = computeGroupResizeDrafts(
      ['box', 'label', 'note', 'locked'],
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, width: 200, height: 200 },
      [container, boundText, independentText, locked],
    );

    expect(drafts.find((el) => el.id === 'box')).toMatchObject({ width: 200, height: 100 });
    expect(drafts.find((el) => el.id === 'label')).toMatchObject({ width: 184 });
    expect(drafts.find((el) => el.id === 'note')).toMatchObject({ x: 100, y: 100 });
    expect(drafts.find((el) => el.id === 'note')?.props.fontSize).toBe(20);
    expect(drafts.find((el) => el.id === 'locked')).toBeUndefined();
  });

  it('@covers AC-13 reuses existing WS events and grouping slots without bound text fields', () => {
    expect(Object.values(WS_EVENTS)).not.toContain('group-merge');
    expect(ELEMENT_FIELD_SYNC_CLASSIFICATION.groupId).toEqual({
      category: 'slot',
      slot: 'grouping.groupId',
    });
    expect(Object.keys(ELEMENT_PROPS_FIELD_SYNC_CLASSIFICATION)).not.toContain('boundContainerId');
    expect(Object.keys(ELEMENT_PROPS_FIELD_SYNC_CLASSIFICATION)).not.toContain('isBoundText');
  });

  it('@covers AC-9 clears the group resize session after committing draft elements', () => {
    const box = makeElement({ id: 'box', groupId: 'g', x: 0, y: 0, width: 100, height: 50 });
    const label = makeElement({ id: 'label', type: 'text', groupId: 'g' });
    const resizedBox = { ...box, width: 200, height: 100 };
    useElementsStore.getState().setElements([box, label]);
    useInteractionStore.getState().setDraggingId('box');
    useInteractionStore.getState().setDragStart({ x: 100, y: 50 });
    useInteractionStore.getState().setResizeHandle('se');
    useInteractionStore.getState().setGroupResizeSession({
      originalBounds: { x: 0, y: 0, width: 100, height: 50 },
      originalHandle: 'se',
      anchor: { x: 0, y: 0 },
      memberIds: ['box', 'label'],
    });
    useInteractionStore.getState().setDraftElements([resizedBox]);

    onSelectPointerUp({ x: 200, y: 100 });

    expect(useElementsStore.getState().elements.find((el) => el.id === 'box')).toMatchObject({
      width: 200,
      height: 100,
    });
    expect(useInteractionStore.getState().groupResizeSession).toBeNull();
    expect(useInteractionStore.getState().resizeHandle).toBeNull();
  });
});
