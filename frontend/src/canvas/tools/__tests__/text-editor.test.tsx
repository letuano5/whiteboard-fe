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
import { computeBoundTextLayout, TEXT_PADDING } from '../../text/text-wrap';

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

// ─── AC-4b: auto-bbox uses natural content dimensions ────────────────────────

describe('TextEditor — AC-4b (auto-bbox uses content dimensions)', () => {
  // @covers AC-4
  it('committed size reflects scrollWidth/scrollHeight regardless of initial element dimensions', () => {
    const el = makeTextElement({ id: 'text-1', width: 200, height: 40 });
    useInteractionStore.getState().setEditingId(el.id);

    const { container } = render(<TextEditor element={el} camera={defaultCamera} />);
    const div = container.querySelector('[contenteditable]') as HTMLElement;

    // Narrow content — narrower than the stored 200px width
    Object.defineProperty(div, 'scrollWidth', { configurable: true, value: 60 });
    Object.defineProperty(div, 'scrollHeight', { configurable: true, value: 20 });

    act(() => { fireEvent.blur(div); });

    // patchElement must use the measured content size, not the stored element size
    expect(mockPatchElement).toHaveBeenCalledWith(
      'text-1',
      expect.objectContaining({ width: 60, height: 20 }),
    );
  });
});

// ─── Bound text: recenter/rewrap on commit instead of free-growing to content ─

describe('TextEditor — bound text recenters and rewraps on commit', () => {
  it('recenters using the bound container, ignoring the editor scroll dimensions', () => {
    const container = makeRectElement({
      id: 'container-1',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      groupId: 'group-1',
    });
    const text = makeTextElement({
      id: 'text-1',
      groupId: 'group-1',
      props: {
        strokeColor: '#1a1a1a',
        fillColor: 'transparent',
        strokeWidth: 0,
        strokeStyle: 'solid',
        opacity: 1,
        text: 'Hi',
        fontSize: 16,
        fontFamily: 'sans-serif',
        textAlign: 'center',
      },
    });
    useElementsStore.getState().setElements([container, text]);
    useInteractionStore.getState().setEditingId(text.id);

    const { container: dom } = render(<TextEditor element={text} camera={defaultCamera} />);
    const div = dom.querySelector('[contenteditable]') as HTMLElement;

    div.innerText = 'Hello World Wraps Here';
    // Free-content scroll size the old (non-bound) code path would have used — must be ignored.
    Object.defineProperty(div, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(div, 'scrollHeight', { configurable: true, value: 900 });
    act(() => {
      fireEvent.blur(div);
    });

    const expected = computeBoundTextLayout(container, {
      props: { ...text.props, text: 'Hello World Wraps Here' },
    });

    expect(mockPatchElement).toHaveBeenCalledWith(
      'text-1',
      expect.objectContaining({
        x: expected.x,
        y: expected.y,
        width: expected.width,
        height: expected.height,
      }),
    );
  });
});

// ─── Bound text: editor overlay matches wrap layout while editing ───────────

describe('TextEditor — bound text overlay matches wrap layout while editing', () => {
  it('sets div width from computeBoundTextLayout and whiteSpace to pre-wrap for bound text', () => {
    const container = makeRectElement({
      id: 'container-1',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      groupId: 'group-1',
    });
    const text = makeTextElement({
      id: 'text-1',
      groupId: 'group-1',
      props: {
        strokeColor: '#1a1a1a',
        fillColor: 'transparent',
        strokeWidth: 0,
        strokeStyle: 'solid',
        opacity: 1,
        text: 'Hi',
        fontSize: 16,
        fontFamily: 'sans-serif',
        textAlign: 'center',
      },
    });
    useElementsStore.getState().setElements([container, text]);
    useInteractionStore.getState().setEditingId(text.id);

    const { container: dom } = render(<TextEditor element={text} camera={defaultCamera} />);
    const div = dom.querySelector('[contenteditable]') as HTMLElement;

    const expected = computeBoundTextLayout(container, { props: text.props });

    expect(div.style.width).toBe(`${expected.width}px`);
    expect(div.style.whiteSpace).toBe('pre-wrap');
  });

  it('scales the bound width by camera zoom', () => {
    const zoomedCamera: Camera = { x: 0, y: 0, zoom: 2 };
    const container = makeRectElement({
      id: 'container-1',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      groupId: 'group-1',
    });
    const text = makeTextElement({
      id: 'text-1',
      groupId: 'group-1',
      props: {
        strokeColor: '#1a1a1a',
        fillColor: 'transparent',
        strokeWidth: 0,
        strokeStyle: 'solid',
        opacity: 1,
        text: 'Hi',
        fontSize: 16,
        fontFamily: 'sans-serif',
        textAlign: 'center',
      },
    });
    useElementsStore.getState().setElements([container, text]);
    useInteractionStore.getState().setEditingId(text.id);

    const { container: dom } = render(<TextEditor element={text} camera={zoomedCamera} />);
    const div = dom.querySelector('[contenteditable]') as HTMLElement;
    const expected = computeBoundTextLayout(container, { props: text.props });

    expect(div.style.width).toBe(`${expected.width * 2}px`);
  });

  it('leaves width unset and whiteSpace as pre for unbound (free) text', () => {
    const el = makeTextElement({ id: 'text-1' }); // groupId: null by default
    useInteractionStore.getState().setEditingId(el.id);

    const { container } = render(<TextEditor element={el} camera={defaultCamera} />);
    const div = container.querySelector('[contenteditable]') as HTMLElement;

    expect(div.style.width).toBe('');
    expect(div.style.whiteSpace).toBe('pre');
  });
});

// ─── Bound text: container auto-grows height to fit wrapped text on commit ──

describe('TextEditor — bound text grows container height to fit wrapped text', () => {
  it('grows the container height (keeping its center fixed) when wrapped text overflows it', () => {
    const container = makeRectElement({
      id: 'container-1',
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      groupId: 'group-1',
    });
    const text = makeTextElement({
      id: 'text-1',
      groupId: 'group-1',
      props: {
        strokeColor: '#1a1a1a',
        fillColor: 'transparent',
        strokeWidth: 0,
        strokeStyle: 'solid',
        opacity: 1,
        text: 'Hi',
        fontSize: 16,
        fontFamily: 'sans-serif',
        textAlign: 'center',
      },
    });
    useElementsStore.getState().setElements([container, text]);
    useInteractionStore.getState().setEditingId(text.id);

    const { container: dom } = render(<TextEditor element={text} camera={defaultCamera} />);
    const div = dom.querySelector('[contenteditable]') as HTMLElement;

    const longText = 'Hello World Wraps Here';
    div.innerText = longText;
    act(() => {
      fireEvent.blur(div);
    });

    const wrapped = computeBoundTextLayout(container, { props: { ...text.props, text: longText } });
    const requiredHeight = wrapped.height + TEXT_PADDING * 2;
    expect(requiredHeight).toBeGreaterThan(container.height); // sanity: text really overflows

    const newHeight = requiredHeight;
    const newY = container.y - (newHeight - container.height) / 2;

    expect(mockPatchElement).toHaveBeenCalledWith(
      'container-1',
      expect.objectContaining({ y: newY, height: newHeight }),
    );

    const grownContainer = { ...container, y: newY, height: newHeight };
    const finalLayout = computeBoundTextLayout(grownContainer, {
      props: { ...text.props, text: longText },
    });

    expect(mockPatchElement).toHaveBeenCalledWith(
      'text-1',
      expect.objectContaining({
        x: finalLayout.x,
        y: finalLayout.y,
        width: finalLayout.width,
        height: finalLayout.height,
      }),
    );
  });

  it('does not resize the container when wrapped text fits within its existing height', () => {
    const container = makeRectElement({
      id: 'container-1',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      groupId: 'group-1',
    });
    const text = makeTextElement({
      id: 'text-1',
      groupId: 'group-1',
      props: {
        strokeColor: '#1a1a1a',
        fillColor: 'transparent',
        strokeWidth: 0,
        strokeStyle: 'solid',
        opacity: 1,
        text: 'Hi',
        fontSize: 16,
        fontFamily: 'sans-serif',
        textAlign: 'center',
      },
    });
    useElementsStore.getState().setElements([container, text]);
    useInteractionStore.getState().setEditingId(text.id);

    const { container: dom } = render(<TextEditor element={text} camera={defaultCamera} />);
    const div = dom.querySelector('[contenteditable]') as HTMLElement;

    div.innerText = 'Short';
    act(() => {
      fireEvent.blur(div);
    });

    expect(mockPatchElement).not.toHaveBeenCalledWith('container-1', expect.anything());
  });
});
