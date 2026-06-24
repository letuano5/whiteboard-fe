import { render, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import type { Camera, Element } from '../../../types/shared';

vi.mock('../../../store/mutation-pipeline', () => ({
  patchElement: vi.fn(),
  createElement: vi.fn(),
  deleteElements: vi.fn(),
  updateElements: vi.fn(),
}));

import { patchElement } from '../../../store/mutation-pipeline';
import TextEditor, { onCanvasDoubleClick } from '../text-editor';

const mockPatchElement = patchElement as ReturnType<typeof vi.fn>;

function makeTextElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'text-1',
    type: 'text',
    x: 100,
    y: 50,
    width: 200,
    height: 40,
    angle: 0,
    zIndex: 1,
    props: {
      strokeColor: '#1a1a1a',
      fillColor: 'transparent',
      strokeWidth: 0,
      strokeStyle: 'solid',
      opacity: 1,
      text: 'Hello',
      fontSize: 16,
      fontFamily: 'sans-serif',
      textAlign: 'left',
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

function makeRectElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'rect-1',
    type: 'rectangle',
    x: 300,
    y: 300,
    width: 100,
    height: 80,
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
    versionNonce: 456,
    updatedAt: Date.now(),
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
    ...overrides,
  };
}

const defaultCamera: Camera = { x: 0, y: 0, zoom: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().reset();
});

// ─── AC-1: Double-click opens editor ─────────────────────────────────────────

describe('onCanvasDoubleClick — AC-1', () => {
  // @covers AC-1
  it('double-clicking inside a text element sets editingId to that element id', () => {
    const el = makeTextElement({ id: 'text-1', x: 100, y: 50, width: 200, height: 40 });
    useElementsStore.getState().addElement(el);

    onCanvasDoubleClick({ x: 150, y: 70 }); // inside bbox

    expect(useInteractionStore.getState().editingId).toBe('text-1');
  });

  // @covers AC-1
  it('double-clicking on an empty area does not set editingId', () => {
    const el = makeTextElement({ id: 'text-1', x: 100, y: 50, width: 200, height: 40 });
    useElementsStore.getState().addElement(el);

    onCanvasDoubleClick({ x: 999, y: 999 }); // outside bbox

    expect(useInteractionStore.getState().editingId).toBeNull();
  });
});

// ─── AC-7: Non-text element double-click ────────────────────────────────────

describe('onCanvasDoubleClick — AC-7', () => {
  // @covers AC-7
  it('double-clicking inside a rectangle does NOT set editingId', () => {
    const rect = makeRectElement({ id: 'rect-1', x: 300, y: 300, width: 100, height: 80 });
    useElementsStore.getState().addElement(rect);

    onCanvasDoubleClick({ x: 350, y: 340 }); // inside rectangle bbox

    expect(useInteractionStore.getState().editingId).toBeNull();
  });

  // @covers AC-7
  it('editingId stays null after double-clicking a non-text shape even when text element exists nearby', () => {
    const rect = makeRectElement({ id: 'rect-1', x: 0, y: 0, width: 50, height: 50 });
    const text = makeTextElement({ id: 'text-1', x: 100, y: 0, width: 100, height: 30 });
    useElementsStore.getState().setElements([rect, text]);

    onCanvasDoubleClick({ x: 25, y: 25 }); // inside rect, outside text

    expect(useInteractionStore.getState().editingId).toBeNull();
  });
});

// ─── AC-2: Blur commits text ─────────────────────────────────────────────────

describe('TextEditor — AC-2 (blur commits)', () => {
  // @covers AC-2
  it('blurring the editor calls patchElement with the current text content', () => {
    const el = makeTextElement({ id: 'text-1' });
    useInteractionStore.getState().setEditingId(el.id);

    const { container } = render(<TextEditor element={el} camera={defaultCamera} />);
    const div = container.querySelector('[contenteditable]') as HTMLElement;
    expect(div).toBeTruthy();

    div.innerText = 'World';
    act(() => { fireEvent.blur(div); });

    expect(mockPatchElement).toHaveBeenCalledWith(
      'text-1',
      expect.objectContaining({
        props: expect.objectContaining({ text: 'World' }),
      }),
    );
  });

  // @covers AC-2
  it('blurring sets editingId back to null', () => {
    const el = makeTextElement({ id: 'text-1' });
    useInteractionStore.getState().setEditingId(el.id);

    const { container } = render(<TextEditor element={el} camera={defaultCamera} />);
    const div = container.querySelector('[contenteditable]') as HTMLElement;

    act(() => { fireEvent.blur(div); });

    expect(useInteractionStore.getState().editingId).toBeNull();
  });
});

// ─── AC-3: Escape commits text ───────────────────────────────────────────────

describe('TextEditor — AC-3 (Escape commits)', () => {
  // @covers AC-3
  // INTENTIONAL: Escape = commit (not discard), per spec "Blur/Esc commit"
  it('pressing Escape calls patchElement with the current text content', () => {
    const el = makeTextElement({ id: 'text-1' });
    useInteractionStore.getState().setEditingId(el.id);

    const { container } = render(<TextEditor element={el} camera={defaultCamera} />);
    const div = container.querySelector('[contenteditable]') as HTMLElement;

    div.innerText = 'Escape Test';
    act(() => {
      div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(mockPatchElement).toHaveBeenCalledWith(
      'text-1',
      expect.objectContaining({
        props: expect.objectContaining({ text: 'Escape Test' }),
      }),
    );
  });

  // @covers AC-3
  it('pressing Escape sets editingId to null', () => {
    const el = makeTextElement({ id: 'text-1' });
    useInteractionStore.getState().setEditingId(el.id);

    const { container } = render(<TextEditor element={el} camera={defaultCamera} />);
    const div = container.querySelector('[contenteditable]') as HTMLElement;

    act(() => {
      div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(useInteractionStore.getState().editingId).toBeNull();
  });

  // @covers AC-3
  it('Escape does not call patchElement twice (no double-commit with subsequent blur)', () => {
    const el = makeTextElement({ id: 'text-1' });
    useInteractionStore.getState().setEditingId(el.id);

    const { container } = render(<TextEditor element={el} camera={defaultCamera} />);
    const div = container.querySelector('[contenteditable]') as HTMLElement;

    act(() => {
      div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      div.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    });

    expect(mockPatchElement).toHaveBeenCalledTimes(1);
  });
});

// ─── AC-4: Auto-bbox after commit ────────────────────────────────────────────

describe('TextEditor — AC-4 (auto-bbox)', () => {
  // @covers AC-4
  it('patchElement is called with width and height derived from div scroll dimensions', () => {
    const el = makeTextElement({ id: 'text-1' });
    useInteractionStore.getState().setEditingId(el.id);

    const { container } = render(<TextEditor element={el} camera={defaultCamera} />);
    const div = container.querySelector('[contenteditable]') as HTMLElement;

    Object.defineProperty(div, 'scrollWidth', { configurable: true, value: 120 });
    Object.defineProperty(div, 'scrollHeight', { configurable: true, value: 24 });

    act(() => { fireEvent.blur(div); });

    expect(mockPatchElement).toHaveBeenCalledWith(
      'text-1',
      expect.objectContaining({
        width: 120,   // scrollWidth / zoom(1)
        height: 24,   // scrollHeight / zoom(1)
      }),
    );
  });

  // @covers AC-4
  it('dimensions are divided by camera zoom to convert to world coordinates', () => {
    const zoomedCamera: Camera = { x: 0, y: 0, zoom: 2 };
    const el = makeTextElement({ id: 'text-2' });
    useInteractionStore.getState().setEditingId(el.id);

    const { container } = render(<TextEditor element={el} camera={zoomedCamera} />);
    const div = container.querySelector('[contenteditable]') as HTMLElement;

    Object.defineProperty(div, 'scrollWidth', { configurable: true, value: 200 });
    Object.defineProperty(div, 'scrollHeight', { configurable: true, value: 48 });

    act(() => { fireEvent.blur(div); });

    expect(mockPatchElement).toHaveBeenCalledWith(
      'text-2',
      expect.objectContaining({
        width: 100,   // 200 / zoom(2)
        height: 24,   // 48 / zoom(2)
      }),
    );
  });
});

// ─── AC-5: Positioning at camera zoom ────────────────────────────────────────

describe('TextEditor — AC-5 (positioning matches camera)', () => {
  // @covers AC-5
  it('editor left and top match world position scaled by zoom with camera offset', () => {
    const camera: Camera = { x: 100, y: 50, zoom: 2 };
    const el = makeTextElement({ id: 'text-1', x: 200, y: 150 });
    useInteractionStore.getState().setEditingId(el.id);

    const { container } = render(<TextEditor element={el} camera={camera} />);
    const div = container.querySelector('[contenteditable]') as HTMLElement;

    // left = (el.x - camera.x) * zoom = (200 - 100) * 2 = 200
    // top  = (el.y - camera.y) * zoom = (150 - 50) * 2 = 200
    expect(div.style.left).toBe('200px');
    expect(div.style.top).toBe('200px');
  });

  // @covers AC-5
  it('editor fontSize scales with camera zoom', () => {
    const camera: Camera = { x: 0, y: 0, zoom: 3 };
    const el = makeTextElement({ id: 'text-1' }); // fontSize: 16
    useInteractionStore.getState().setEditingId(el.id);

    const { container } = render(<TextEditor element={el} camera={camera} />);
    const div = container.querySelector('[contenteditable]') as HTMLElement;

    // fontSize = 16 * zoom(3) = 48
    expect(div.style.fontSize).toBe('48px');
  });

  // @covers AC-5
  it('editor transform includes rotation when element angle is non-zero', () => {
    const camera: Camera = { x: 0, y: 0, zoom: 1 };
    const el = makeTextElement({ id: 'text-1', angle: Math.PI / 4 }); // 45 degrees
    useInteractionStore.getState().setEditingId(el.id);

    const { container } = render(<TextEditor element={el} camera={camera} />);
    const div = container.querySelector('[contenteditable]') as HTMLElement;

    expect(div.style.transform).toMatch(/rotate\(45(\.0+)?deg\)/);
  });

  // @covers AC-5
  it('editor transform is empty or identity when element angle is zero', () => {
    const camera: Camera = { x: 0, y: 0, zoom: 1 };
    const el = makeTextElement({ id: 'text-1', angle: 0 });
    useInteractionStore.getState().setEditingId(el.id);

    const { container } = render(<TextEditor element={el} camera={camera} />);
    const div = container.querySelector('[contenteditable]') as HTMLElement;

    // either no transform or identity rotate(0deg)
    expect(div.style.transform).toMatch(/rotate\(0(\.0+)?deg\)|^$/);
  });
});

// ─── AC-6: Empty text keeps element ─────────────────────────────────────────

describe('TextEditor — AC-6 (empty text keeps element)', () => {
  // @covers AC-6
  it('committing empty text calls patchElement with text: "" and does NOT call deleteElements', async () => {
    const { deleteElements } = await import('../../../store/mutation-pipeline');
    const el = makeTextElement({ id: 'text-1' });
    useInteractionStore.getState().setEditingId(el.id);

    const { container } = render(<TextEditor element={el} camera={defaultCamera} />);
    const div = container.querySelector('[contenteditable]') as HTMLElement;

    div.innerText = '';
    act(() => { fireEvent.blur(div); });

    expect(mockPatchElement).toHaveBeenCalledWith(
      'text-1',
      expect.objectContaining({
        props: expect.objectContaining({ text: '' }),
      }),
    );
    expect(deleteElements).not.toHaveBeenCalled();
  });
});

// ─── AC-8: editingId lifecycle ───────────────────────────────────────────────

describe('editingId lifecycle — AC-8', () => {
  // @covers AC-8
  it('editingId equals element id while editor is mounted', () => {
    const el = makeTextElement({ id: 'text-1' });
    useInteractionStore.getState().setEditingId(el.id);

    render(<TextEditor element={el} camera={defaultCamera} />);

    expect(useInteractionStore.getState().editingId).toBe('text-1');
  });

  // @covers AC-8
  it('editingId returns to null after blur', () => {
    const el = makeTextElement({ id: 'text-1' });
    useInteractionStore.getState().setEditingId(el.id);

    const { container } = render(<TextEditor element={el} camera={defaultCamera} />);
    const div = container.querySelector('[contenteditable]') as HTMLElement;

    act(() => { fireEvent.blur(div); });

    expect(useInteractionStore.getState().editingId).toBeNull();
  });
});
