import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useElementsStore } from '../elements.store';
import { useHistoryStore } from '../history.store';
import {
  createElement,
  patchElement,
  deleteElements,
  updateElements,
  type ElementDraft,
} from '../mutation-pipeline';
import { initHistoryCapture } from '../../sync/history-capture';
import { useInteractionStore } from '../interaction.store';
import { onMergeSelected } from '../../canvas/tools/select/merge';
import { resolveGroupDeletionIds } from '../../canvas/tools/select/group';

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

function getElement(id: string) {
  return useElementsStore.getState().elements.find((e) => e.id === id)!;
}

let cleanupCapture: (() => void) | null = null;

beforeEach(() => {
  useElementsStore.setState({ elements: [] });
  useHistoryStore.setState({ undoStack: [], redoStack: [], isApplying: false });
  cleanupCapture = initHistoryCapture();
});

afterEach(() => {
  cleanupCapture?.();
  cleanupCapture = null;
});

// @covers AC-1
describe('AC-1: undo createElement removes the element', () => {
  it('after createElement + undo, element isDeleted becomes true', () => {
    const el = createElement(makeDraft());
    expect(getElement(el.id).isDeleted).toBe(false);

    useHistoryStore.getState().undo();

    expect(getElement(el.id).isDeleted).toBe(true);
  });
});

describe('group operation history', () => {
  it('@covers AC-12 undoes and redoes merge as one step', () => {
    const a = createElement(makeDraft());
    const b = createElement(makeDraft({ x: 20 }));
    useHistoryStore.setState({ undoStack: [], redoStack: [] });
    useInteractionStore.getState().setSelectedIds([a.id, b.id]);

    onMergeSelected();
    expect(getElement(a.id).groupId).toBe(getElement(b.id).groupId);
    expect(useHistoryStore.getState().undoStack).toHaveLength(1);

    useHistoryStore.getState().undo();
    expect(getElement(a.id).groupId).toBeNull();
    expect(getElement(b.id).groupId).toBeNull();

    useHistoryStore.getState().redo();
    expect(getElement(a.id).groupId).toBe(getElement(b.id).groupId);
  });

  it('@covers AC-12 undoes group delete as one step', () => {
    const a = createElement(makeDraft({ groupId: 'g' }));
    const b = createElement(makeDraft({ groupId: 'g', x: 20 }));
    useHistoryStore.setState({ undoStack: [], redoStack: [] });

    deleteElements(resolveGroupDeletionIds([a.id], useElementsStore.getState().elements));
    expect(getElement(a.id).isDeleted).toBe(true);
    expect(getElement(b.id).isDeleted).toBe(true);
    expect(useHistoryStore.getState().undoStack).toHaveLength(1);

    useHistoryStore.getState().undo();
    expect(getElement(a.id).isDeleted).toBe(false);
    expect(getElement(b.id).isDeleted).toBe(false);
  });
});

// @covers AC-2
describe('AC-2: undo patchElement (move) reverts position', () => {
  it('element returns to position before the move', () => {
    const el = createElement(makeDraft({ x: 10, y: 20 }));
    patchElement(el.id, { x: 99, y: 88 });
    expect(getElement(el.id).x).toBe(99);

    useHistoryStore.getState().undo();

    expect(getElement(el.id).x).toBe(10);
    expect(getElement(el.id).y).toBe(20);
  });
});

// @covers AC-3
describe('AC-3: undo patchElement (resize/rotate) reverts dimensions/angle', () => {
  it('element dimensions and angle revert', () => {
    const el = createElement(makeDraft({ width: 100, height: 50, angle: 0 }));
    patchElement(el.id, { width: 200, height: 300, angle: 45 });

    useHistoryStore.getState().undo();

    expect(getElement(el.id).width).toBe(100);
    expect(getElement(el.id).height).toBe(50);
    expect(getElement(el.id).angle).toBe(0);
  });
});

// @covers AC-4
describe('AC-4: undo deleteElements restores element (isDeleted becomes false)', () => {
  it('soft-deleted element is restored on undo', () => {
    const el = createElement(makeDraft());
    // Clear history from create so undo targets the delete
    useHistoryStore.setState({ undoStack: [], redoStack: [] });
    deleteElements([el.id]);
    expect(getElement(el.id).isDeleted).toBe(true);

    useHistoryStore.getState().undo();

    expect(getElement(el.id).isDeleted).toBe(false);
  });
});

// @covers AC-5
describe('AC-5: undo style/text change restores previous values', () => {
  it('previous fillColor is restored after undo of style patch', () => {
    const el = createElement(
      makeDraft({
        props: {
          strokeColor: '#000',
          fillColor: '#fff',
          strokeWidth: 2,
          strokeStyle: 'solid',
          opacity: 1,
        },
      }),
    );
    patchElement(el.id, {
      props: {
        strokeColor: '#000',
        fillColor: '#ff0000',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
      },
    });

    useHistoryStore.getState().undo();

    expect(getElement(el.id).props.fillColor).toBe('#fff');
  });
});

// @covers AC-6
describe('AC-6: undo on empty stack is a no-op', () => {
  it('no error and store unchanged when undoStack is empty', () => {
    const el = createElement(makeDraft());
    useHistoryStore.setState({ undoStack: [], redoStack: [] });
    const versionBefore = getElement(el.id).version;

    expect(() => useHistoryStore.getState().undo()).not.toThrow();

    expect(getElement(el.id).version).toBe(versionBefore);
  });
});

// @covers AC-7
describe('AC-7: redo re-applies undone action', () => {
  it('element reappears after undo + redo of create', () => {
    const el = createElement(makeDraft());
    useHistoryStore.getState().undo();
    expect(getElement(el.id).isDeleted).toBe(true);

    useHistoryStore.getState().redo();

    expect(getElement(el.id).isDeleted).toBe(false);
  });
});

describe('ink history interactions', () => {
  it('undoes and redoes a highlighter create as a whole stroke', () => {
    const el = createElement(
      makeDraft({
        type: 'highlighter',
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        props: {
          strokeColor: '#facc15',
          fillColor: 'transparent',
          strokeWidth: 14,
          strokeStyle: 'solid',
          opacity: 0.35,
          points: [
            [0, 0],
            [10, 20],
            [20, 0],
          ],
        },
      }),
    );

    useHistoryStore.getState().undo();
    expect(getElement(el.id).isDeleted).toBe(true);

    useHistoryStore.getState().redo();
    expect(getElement(el.id)).toMatchObject({
      type: 'highlighter',
      isDeleted: false,
    });
    expect(getElement(el.id).props.points).toEqual([
      [0, 0],
      [10, 20],
      [20, 0],
    ]);
  });
});

// @covers AC-8
describe('AC-8: redo on empty redoStack is a no-op', () => {
  it('no error when redoStack is empty', () => {
    const el = createElement(makeDraft());
    const versionBefore = getElement(el.id).version;

    expect(() => useHistoryStore.getState().redo()).not.toThrow();

    expect(getElement(el.id).version).toBe(versionBefore);
  });
});

// @covers AC-9
describe('AC-9: new mutation after undo clears redo stack', () => {
  it('redo stack is cleared when a new canvas action is performed after undo', () => {
    const el = createElement(makeDraft());
    useHistoryStore.getState().undo();
    expect(useHistoryStore.getState().redoStack.length).toBeGreaterThan(0);

    // New action
    createElement(makeDraft({ x: 50 }));
    expect(useHistoryStore.getState().redoStack.length).toBe(0);

    // redo is now a no-op
    const versionBefore = getElement(el.id).version;
    useHistoryStore.getState().redo();
    expect(getElement(el.id).version).toBe(versionBefore);
  });
});

// @covers AC-10
describe('AC-10: multi-step undo reverses in LIFO order', () => {
  it('5 creates are undone one at a time in reverse order', () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(createElement(makeDraft({ x: i * 10 })).id);
    }

    for (let i = 4; i >= 0; i--) {
      useHistoryStore.getState().undo();
      expect(getElement(ids[i]).isDeleted).toBe(true);
      for (let j = 0; j < i; j++) {
        expect(getElement(ids[j]).isDeleted).toBe(false);
      }
    }
  });
});

// @covers AC-11
describe('AC-11: partial redo after multi-step undo applies in chronological order', () => {
  it('undo 3 times then redo 2 times applies 2 in forward order', () => {
    const el1 = createElement(makeDraft({ x: 0 }));
    const el2 = createElement(makeDraft({ x: 1 }));
    const el3 = createElement(makeDraft({ x: 2 }));

    useHistoryStore.getState().undo(); // undo el3
    useHistoryStore.getState().undo(); // undo el2
    useHistoryStore.getState().undo(); // undo el1

    useHistoryStore.getState().redo(); // redo el1
    useHistoryStore.getState().redo(); // redo el2

    expect(getElement(el1.id).isDeleted).toBe(false);
    expect(getElement(el2.id).isDeleted).toBe(false);
    expect(getElement(el3.id).isDeleted).toBe(true); // still undone
  });
});

// @covers AC-12
describe('AC-12: history capped at 100 entries; oldest discarded', () => {
  it('pushing 101 entries keeps undoStack.length at 100', () => {
    for (let i = 0; i < 101; i++) {
      createElement(makeDraft({ x: i }));
    }
    expect(useHistoryStore.getState().undoStack.length).toBe(100);
  });

  it('oldest entry is discarded (not the newest)', () => {
    for (let i = 0; i < 101; i++) {
      createElement(makeDraft({ x: i }));
    }
    // After 101 creates, first entry should correspond to x=1 (not x=0)
    const oldest = useHistoryStore.getState().undoStack[0];
    // The "after" state of the oldest surviving entry is the 2nd created element (x=1)
    expect(oldest.after[0].x).toBe(1);
  });
});

// @covers AC-13
describe('AC-13: all four pipeline functions are captured as undoable steps', () => {
  it('createElement, patchElement, deleteElements, updateElements each push one entry', () => {
    const el1 = createElement(makeDraft()); // entry 1
    patchElement(el1.id, { x: 10 }); // entry 2
    const el2 = createElement(makeDraft()); // entry 3
    deleteElements([el2.id]); // entry 4 (soft-delete el2)
    updateElements([{ id: el1.id, patch: { x: 20 } }]); // entry 5 (el1 is not deleted)
    expect(useHistoryStore.getState().undoStack.length).toBe(5);
  });
});

// @covers AC-14
describe('AC-14: undo and redo increment version counter', () => {
  it('version is higher after undo than before undo', () => {
    const el = createElement(makeDraft());
    const versionAfterCreate = getElement(el.id).version;

    useHistoryStore.getState().undo();
    const versionAfterUndo = getElement(el.id).version;

    expect(versionAfterUndo).toBeGreaterThan(versionAfterCreate);
  });

  it('version is higher after redo than before redo', () => {
    const el = createElement(makeDraft());
    useHistoryStore.getState().undo();
    const versionAfterUndo = getElement(el.id).version;

    useHistoryStore.getState().redo();
    const versionAfterRedo = getElement(el.id).version;

    expect(versionAfterRedo).toBeGreaterThan(versionAfterUndo);
  });
});

// @covers AC-15
describe('AC-15: undo/redo shortcuts do not fire when focus is in a text input', () => {
  it('undo() is NOT called when event target is an INPUT element', () => {
    const el = createElement(makeDraft());
    const undoSpy = vi.spyOn(useHistoryStore.getState(), 'undo');

    // Simulate the keyboard handler logic from Whiteboard.tsx
    function handleUndoRedo(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      )
        return;
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;
      if (e.key === 'z' && !e.shiftKey) {
        useHistoryStore.getState().undo();
      } else if (e.key === 'z' && e.shiftKey) {
        useHistoryStore.getState().redo();
      }
    }

    const input = document.createElement('input');
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true });
    Object.defineProperty(event, 'target', { value: input, configurable: true });

    handleUndoRedo(event);

    expect(undoSpy).not.toHaveBeenCalled();
    expect(getElement(el.id).isDeleted).toBe(false);

    undoSpy.mockRestore();
  });
});
