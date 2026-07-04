import { beforeEach, describe, expect, it } from 'vitest';
import { useElementsStore } from '../../../../store/elements.store';
import { createBoundTextForContainer } from '../bind-text-on-container';
import { resolveGroupBinding } from '../group';
import { makeElement } from './test-utils';

beforeEach(() => {
  useElementsStore.getState().setElements([]);
});

describe('createBoundTextForContainer', () => {
  it('creates a centered text element sharing a fresh groupId with an ungrouped container', () => {
    const container = makeElement({ id: 'rect-1', x: 0, y: 0, width: 200, height: 100 });
    useElementsStore.getState().setElements([container]);

    const text = createBoundTextForContainer(container);

    const elements = useElementsStore.getState().elements;
    const patchedContainer = elements.find((el) => el.id === 'rect-1')!;
    expect(patchedContainer.groupId).toBeTruthy();
    expect(text.groupId).toBe(patchedContainer.groupId);
    expect(text.type).toBe('text');
    expect(text.props.textAlign).toBe('center');
    expect(text.props.text).toBe('');

    // Centered within the container's bbox.
    expect(text.x + text.width / 2).toBeCloseTo(container.x + container.width / 2);
    expect(text.y + text.height / 2).toBeCloseTo(container.y + container.height / 2);

    const binding = resolveGroupBinding(text.groupId!, elements);
    expect(binding).toEqual({ textId: text.id, containerId: container.id });
  });

  it('reuses the container existing groupId instead of generating a new one', () => {
    const container = makeElement({ id: 'rect-1', groupId: 'existing-group' });
    useElementsStore.getState().setElements([container]);

    const text = createBoundTextForContainer(container);

    expect(text.groupId).toBe('existing-group');
    // Container's own groupId is untouched (no redundant patch).
    const patchedContainer = useElementsStore.getState().elements.find((el) => el.id === 'rect-1')!;
    expect(patchedContainer.groupId).toBe('existing-group');
    expect(patchedContainer.version).toBe(container.version);
  });
});
