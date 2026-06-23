import { describe, it, expect, beforeEach, vi } from 'vitest';
import { onSelectPointerDown } from '../select-tool';
import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import type { Element } from '../../../types/shared';

function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'el-1',
    type: 'rectangle',
    x: 10,
    y: 10,
    width: 100,
    height: 50,
    angle: 0,
    zIndex: 1,
    props: {
      strokeColor: '#000',
      fillColor: '#fff',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
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

beforeEach(() => {
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().setSelectedIds([]);
});

describe('onSelectPointerDown — User Story 1: click to select', () => {
  // @covers AC-1
  it('clicking inside shape bbox sets selectedIds to that shape id', () => {
    const el = makeElement({ id: 'rect-1', x: 10, y: 10, width: 100, height: 50 });
    useElementsStore.getState().addElement(el);

    onSelectPointerDown({ x: 60, y: 30 });

    expect(useInteractionStore.getState().selectedIds).toContain('rect-1');
  });

  // @covers AC-2
  it('overlapping shapes: higher zIndex shape is selected', () => {
    const low = makeElement({ id: 'low-z', x: 0, y: 0, width: 100, height: 100, zIndex: 1 });
    const high = makeElement({ id: 'high-z', x: 0, y: 0, width: 100, height: 100, zIndex: 2 });
    useElementsStore.getState().setElements([low, high]);

    onSelectPointerDown({ x: 50, y: 50 });

    expect(useInteractionStore.getState().selectedIds).toEqual(['high-z']);
  });

  // @covers AC-3
  it('clicking shape B while A is selected replaces selection with B only', () => {
    const a = makeElement({ id: 'shape-a', x: 0, y: 0, width: 50, height: 50, zIndex: 1 });
    const b = makeElement({ id: 'shape-b', x: 100, y: 0, width: 50, height: 50, zIndex: 1 });
    useElementsStore.getState().setElements([a, b]);
    useInteractionStore.getState().setSelectedIds(['shape-a']);

    onSelectPointerDown({ x: 125, y: 25 });

    expect(useInteractionStore.getState().selectedIds).toEqual(['shape-b']);
  });
});

describe('onSelectPointerDown — User Story 2: deselect', () => {
  // @covers AC-4
  it('clicking empty area when shape is selected clears selectedIds', () => {
    const el = makeElement({ id: 'rect-1', x: 0, y: 0, width: 50, height: 50 });
    useElementsStore.getState().setElements([el]);
    useInteractionStore.getState().setSelectedIds(['rect-1']);

    onSelectPointerDown({ x: 200, y: 200 });

    expect(useInteractionStore.getState().selectedIds).toEqual([]);
  });

  // @covers AC-5
  it('clicking empty area when nothing is selected causes no error', () => {
    useElementsStore.getState().setElements([]);

    expect(() => onSelectPointerDown({ x: 50, y: 50 })).not.toThrow();
    expect(useInteractionStore.getState().selectedIds).toEqual([]);
  });
});

describe('onSelectPointerDown — AC-6: selection state isolation', () => {
  // @covers AC-6
  it('never mutates elementsStore on click', () => {
    const el = makeElement({ id: 'rect-1', x: 0, y: 0, width: 100, height: 100 });
    useElementsStore.getState().setElements([el]);
    const elementsBefore = useElementsStore.getState().elements;

    onSelectPointerDown({ x: 50, y: 50 });

    expect(useElementsStore.getState().elements).toBe(elementsBefore);
  });

  // @covers AC-6
  it('never calls localStorage.setItem during selection', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const el = makeElement({ id: 'rect-1', x: 0, y: 0, width: 100, height: 100 });
    useElementsStore.getState().setElements([el]);

    onSelectPointerDown({ x: 50, y: 50 });

    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });
});

describe('onSelectPointerDown — edge cases', () => {
  it('empty elements store: no error, selectedIds stays []', () => {
    useElementsStore.getState().setElements([]);

    expect(() => onSelectPointerDown({ x: 0, y: 0 })).not.toThrow();
    expect(useInteractionStore.getState().selectedIds).toEqual([]);
  });

  it('isDeleted elements are ignored even if click hits their bbox', () => {
    const deleted = makeElement({
      id: 'deleted-el',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      isDeleted: true,
    });
    useElementsStore.getState().setElements([deleted]);

    onSelectPointerDown({ x: 50, y: 50 });

    expect(useInteractionStore.getState().selectedIds).toEqual([]);
  });
});
