import { describe, it, expect, beforeEach } from 'vitest';
import { useElementsStore } from '../elements.store';
import {
  createElement,
  patchElement,
  deleteElements,
  updateElements,
  registerMutationHook,
  type ElementDraft,
  type MutationEvent,
} from '../mutation-pipeline';

function makeDraft(overrides: Partial<ElementDraft> = {}): ElementDraft {
  return {
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle: 0,
    props: {
      strokeColor: '#000000',
      fillColor: '#ffffff',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
    },
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
    ...overrides,
  };
}

beforeEach(() => {
  useElementsStore.setState({ elements: [] });
});

describe('createElement', () => {
  it('adds element to store with correct metadata', () => {
    const before = Date.now();
    const el = createElement(makeDraft());
    const after = Date.now();

    expect(el.id).toBeTruthy();
    expect(el.version).toBe(1);
    expect(typeof el.versionNonce).toBe('number');
    expect(el.updatedAt).toBeGreaterThanOrEqual(before);
    expect(el.updatedAt).toBeLessThanOrEqual(after);
    expect(el.isDeleted).toBe(false);

    const { elements } = useElementsStore.getState();
    expect(elements).toHaveLength(1);
    expect(elements[0].id).toBe(el.id);
  });

  // @covers AC-11 (006-localstorage-zorder)
  it('assigns zIndex = 1 when store is empty', () => {
    const el = createElement(makeDraft());
    expect(el.zIndex).toBe(1);
  });

  it('assigns incrementing zIndex for subsequent elements', () => {
    const el1 = createElement(makeDraft());
    const el2 = createElement(makeDraft());
    expect(el2.zIndex).toBe(el1.zIndex + 1);
  });

  // @covers AC-10 (006-localstorage-zorder)
  it('assigns zIndex = max(existing) + 1 when existing elements have non-sequential zIndex values', () => {
    // Seed store with elements at zIndex 3, 7, 2 — max is 7
    const base = { ...makeDraft(), version: 1, versionNonce: 1, updatedAt: 0, isDeleted: false };
    useElementsStore.setState({
      elements: [
        { ...base, id: 'seed-a', zIndex: 3 },
        { ...base, id: 'seed-b', zIndex: 7 },
        { ...base, id: 'seed-c', zIndex: 2 },
      ],
    });

    const el = createElement(makeDraft());
    expect(el.zIndex).toBe(8); // max(3, 7, 2) + 1 = 8
  });

  it('generates unique IDs for each element', () => {
    const el1 = createElement(makeDraft());
    const el2 = createElement(makeDraft());
    expect(el1.id).not.toBe(el2.id);
  });
});

describe('patchElement', () => {
  it('increments version and updates fields', () => {
    const el = createElement(makeDraft());

    patchElement(el.id, { x: 50, y: 80 });

    const { elements } = useElementsStore.getState();
    const updated = elements.find((e) => e.id === el.id)!;
    expect(updated.x).toBe(50);
    expect(updated.y).toBe(80);
    expect(updated.version).toBe(2);
    expect(updated.versionNonce).not.toBe(el.versionNonce);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(el.updatedAt);
  });

  it('does nothing for a non-existent id', () => {
    createElement(makeDraft());
    const { elements: before } = useElementsStore.getState();
    patchElement('non-existent-id', { x: 999 });
    const { elements: after } = useElementsStore.getState();
    expect(after[0].version).toBe(before[0].version);
  });

  it('does nothing for a soft-deleted element', () => {
    const el = createElement(makeDraft());
    deleteElements([el.id]);
    patchElement(el.id, { x: 999 });

    const { elements } = useElementsStore.getState();
    const found = elements.find((e) => e.id === el.id)!;
    expect(found.x).toBe(0);
  });
});

describe('deleteElements', () => {
  it('soft-deletes: sets isDeleted=true and keeps element in store', () => {
    const el = createElement(makeDraft());

    deleteElements([el.id]);

    const { elements } = useElementsStore.getState();
    expect(elements).toHaveLength(1);
    const found = elements.find((e) => e.id === el.id)!;
    expect(found.isDeleted).toBe(true);
    expect(found.version).toBe(2);
  });

  it('increments version and nonce on soft delete', () => {
    const el = createElement(makeDraft());
    deleteElements([el.id]);
    const { elements } = useElementsStore.getState();
    const found = elements.find((e) => e.id === el.id)!;
    expect(found.version).toBeGreaterThan(el.version);
  });

  it('ignores ids that are already deleted', () => {
    const el = createElement(makeDraft());
    deleteElements([el.id]);
    const versionAfterFirst = useElementsStore
      .getState()
      .elements.find((e) => e.id === el.id)!.version;

    deleteElements([el.id]);
    const versionAfterSecond = useElementsStore
      .getState()
      .elements.find((e) => e.id === el.id)!.version;
    expect(versionAfterSecond).toBe(versionAfterFirst);
  });
});

describe('updateElements', () => {
  it('batch-updates multiple elements', () => {
    const el1 = createElement(makeDraft({ x: 0 }));
    const el2 = createElement(makeDraft({ x: 0 }));

    updateElements([
      { id: el1.id, patch: { x: 100 } },
      { id: el2.id, patch: { x: 200 } },
    ]);

    const { elements } = useElementsStore.getState();
    expect(elements.find((e) => e.id === el1.id)!.x).toBe(100);
    expect(elements.find((e) => e.id === el2.id)!.x).toBe(200);
  });

  it('increments version for each updated element', () => {
    const el = createElement(makeDraft());
    updateElements([{ id: el.id, patch: { x: 50 } }]);
    const found = useElementsStore.getState().elements.find((e) => e.id === el.id)!;
    expect(found.version).toBe(2);
  });

  it('skips ids that do not exist', () => {
    const el = createElement(makeDraft());
    updateElements([{ id: 'ghost-id', patch: { x: 999 } }]);
    const found = useElementsStore.getState().elements.find((e) => e.id === el.id)!;
    expect(found.version).toBe(1);
  });

  it('does nothing for a soft-deleted element', () => {
    const el = createElement(makeDraft({ x: 0 }));
    deleteElements([el.id]);
    const versionAfterDelete = useElementsStore
      .getState()
      .elements.find((e) => e.id === el.id)!.version;

    updateElements([{ id: el.id, patch: { x: 999 } }]);

    const found = useElementsStore.getState().elements.find((e) => e.id === el.id)!;
    expect(found.x).toBe(0);
    expect(found.version).toBe(versionAfterDelete);
  });
});

describe('registerMutationHook', () => {
  it('calls hook on createElement with correct event type', () => {
    const events: MutationEvent[] = [];
    const unregister = registerMutationHook((e) => events.push(e));

    createElement(makeDraft());
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('create');
    expect(events[0].elements).toHaveLength(1);

    unregister();
  });

  it('calls hook on patchElement', () => {
    const el = createElement(makeDraft());
    const events: MutationEvent[] = [];
    const unregister = registerMutationHook((e) => events.push(e));

    patchElement(el.id, { x: 42 });
    expect(events[0].type).toBe('patch');

    unregister();
  });

  it('calls hook on deleteElements', () => {
    const el = createElement(makeDraft());
    const events: MutationEvent[] = [];
    const unregister = registerMutationHook((e) => events.push(e));

    deleteElements([el.id]);
    expect(events[0].type).toBe('delete');
    expect(events[0].elements[0].isDeleted).toBe(true);

    unregister();
  });

  it('calls hook on updateElements', () => {
    const el = createElement(makeDraft());
    const events: MutationEvent[] = [];
    const unregister = registerMutationHook((e) => events.push(e));

    updateElements([{ id: el.id, patch: { x: 99 } }]);
    expect(events[0].type).toBe('update');

    unregister();
  });

  it('unregister stops the hook from being called', () => {
    const calls: number[] = [];
    const unregister = registerMutationHook(() => calls.push(1));

    createElement(makeDraft());
    expect(calls).toHaveLength(1);

    unregister();
    createElement(makeDraft());
    expect(calls).toHaveLength(1);
  });
});

describe('optimistic update — 014/AC-5', () => {
  // @covers 014/AC-5
  // The store must be updated BEFORE hooks fire so the UI reflects the change
  // immediately (no round-trip wait). This is the client-side "optimistic update"
  // guarantee for P2-03.
  it('createElement: store contains the new element when the mutation hook fires', () => {
    let elementInStoreAtHookTime: boolean | undefined;

    const unregister = registerMutationHook((event) => {
      const { elements } = useElementsStore.getState();
      elementInStoreAtHookTime = elements.some((e) => e.id === event.elements[0].id);
    });

    const created = createElement(makeDraft());
    unregister();

    expect(elementInStoreAtHookTime).toBe(true);
    expect(created.id).toBeDefined();
  });

  it('patchElement: store reflects the patch when the mutation hook fires', () => {
    const el = createElement(makeDraft({ x: 0 }));
    let xInStoreAtHookTime: number | undefined;

    const unregister = registerMutationHook((event) => {
      const { elements } = useElementsStore.getState();
      const found = elements.find((e) => e.id === event.elements[0]?.id);
      xInStoreAtHookTime = found?.x;
    });

    patchElement(el.id, { x: 999 });
    unregister();

    expect(xInStoreAtHookTime).toBe(999);
  });

  it('deleteElements: store marks element isDeleted=true when the mutation hook fires', () => {
    const el = createElement(makeDraft());
    let isDeletedAtHookTime: boolean | undefined;

    const unregister = registerMutationHook((event) => {
      const { elements } = useElementsStore.getState();
      const found = elements.find((e) => e.id === event.elements[0]?.id);
      isDeletedAtHookTime = found?.isDeleted;
    });

    deleteElements([el.id]);
    unregister();

    expect(isDeletedAtHookTime).toBe(true);
  });
});
