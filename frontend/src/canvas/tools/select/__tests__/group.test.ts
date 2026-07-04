import { describe, expect, it } from 'vitest';
import {
  resolveGroupBinding,
  resolveGroupDeletionIds,
  resolveGroupMembers,
  resolveSelectionGroupIds,
} from '../group';
import { makeElement } from './test-utils';

describe('group selectors', () => {
  it('@covers AC-10 resolves live members and deletion ids while excluding locked members', () => {
    const elements = [
      makeElement({ id: 'a', groupId: 'g' }),
      makeElement({ id: 'b', groupId: 'g', locked: true }),
      makeElement({ id: 'c', groupId: 'g', isDeleted: true }),
      makeElement({ id: 'd' }),
    ];

    expect(resolveGroupMembers('g', elements).map((el) => el.id)).toEqual(['a', 'b']);
    expect(resolveGroupDeletionIds(['a', 'd'], elements)).toEqual(['a', 'd']);
  });

  it('@covers AC-4 @covers AC-5 resolves binding only for exactly one text and one container', () => {
    expect(
      resolveGroupBinding('g', [
        makeElement({ id: 'box', type: 'rectangle', groupId: 'g' }),
        makeElement({ id: 'label', type: 'text', groupId: 'g' }),
      ]),
    ).toEqual({ textId: 'label', containerId: 'box' });

    expect(
      resolveGroupBinding('g', [
        makeElement({ id: 'box-a', type: 'rectangle', groupId: 'g' }),
        makeElement({ id: 'box-b', type: 'ellipse', groupId: 'g' }),
        makeElement({ id: 'label', type: 'text', groupId: 'g' }),
      ]),
    ).toBeNull();

    expect(
      resolveGroupBinding('g', [
        makeElement({ id: 'box', type: 'rectangle', groupId: 'g' }),
        makeElement({ id: 'label-a', type: 'text', groupId: 'g' }),
        makeElement({ id: 'label-b', type: 'text', groupId: 'g' }),
      ]),
    ).toBeNull();
  });

  it('@covers AC-8 resolves a selected shared group to all member ids', () => {
    const elements = [
      makeElement({ id: 'a', groupId: 'g' }),
      makeElement({ id: 'b', groupId: 'g' }),
      makeElement({ id: 'c' }),
    ];

    expect(resolveSelectionGroupIds(['a'], elements)).toEqual(['a', 'b']);
    expect(resolveSelectionGroupIds(['a', 'c'], elements)).toBeNull();
  });
});
