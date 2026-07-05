import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DetailPanel from '../DetailPanel';
import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import * as pipeline from '../../../store/mutation-pipeline';
import type { Element } from '../../../types/shared';

function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'test-el',
    type: 'rectangle',
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    angle: 0,
    zIndex: 1,
    props: {
      strokeColor: '#000000',
      fillColor: '#ffffff',
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

const TEXT_PROPS = {
  strokeColor: '#000000',
  fillColor: 'none',
  strokeWidth: 1,
  strokeStyle: 'solid' as const,
  opacity: 1,
  fontSize: 16,
  fontFamily: 'sans-serif',
  textAlign: 'left' as const,
  text: 'Hello',
};

let patchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  useElementsStore.setState({ elements: [] });
  useInteractionStore.getState().reset();
  patchSpy = vi.spyOn(pipeline, 'patchElement').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// @covers AC-1
// @covers AC-2 (005-detail-panel-toolbar)
describe('AC-1: panel renders when one shape is selected', () => {
  it('shows stroke color control when a shape is selected', () => {
    const el = makeElement({ id: 'el-1' });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    expect(screen.getByLabelText(/stroke color/i)).toBeInTheDocument();
  });
});

// @covers AC-2
// @covers AC-1 (005-detail-panel-toolbar)
// @covers AC-3 (005-detail-panel-toolbar)
describe('AC-2: panel hidden when nothing selected', () => {
  it('renders nothing when selectedIds is empty', () => {
    const el = makeElement({ id: 'el-1' });
    useElementsStore.setState({ elements: [el] });
    const { container } = render(<DetailPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders multi-select panel when selectedIds has multiple items', () => {
    const el1 = makeElement({ id: 'el-1' });
    const el2 = makeElement({ id: 'el-2' });
    useElementsStore.setState({ elements: [el1, el2] });
    useInteractionStore.getState().setSelectedIds(['el-1', 'el-2']);
    const { container } = render(<DetailPanel />);
    expect(container.firstChild).not.toBeNull();
  });
});

// @covers AC-3
// @covers AC-4 (005-detail-panel-toolbar)
describe('AC-3: stroke color change updates element immediately', () => {
  it('calls patchElement with new strokeColor', () => {
    const el = makeElement({ id: 'el-1' });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    fireEvent.change(screen.getByLabelText(/stroke color/i), { target: { value: '#ff0000' } });
    expect(patchSpy).toHaveBeenCalledWith('el-1', {
      props: { ...el.props, strokeColor: '#ff0000' },
    });
  });
});

// @covers AC-4
describe('AC-4: fill color change updates element; hidden for line', () => {
  it('calls patchElement with new fillColor for rectangle', () => {
    const el = makeElement({ id: 'el-1' });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    fireEvent.change(screen.getByLabelText(/fill color/i), { target: { value: '#0000ff' } });
    expect(patchSpy).toHaveBeenCalledWith('el-1', {
      props: { ...el.props, fillColor: '#0000ff' },
    });
  });

  it('sets fillColor to transparent from the no-fill control', () => {
    const el = makeElement({ id: 'el-1' });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);

    fireEvent.click(screen.getByRole('button', { name: /transparent fill/i }));

    expect(patchSpy).toHaveBeenCalledWith('el-1', {
      props: { ...el.props, fillColor: 'transparent' },
    });
  });

  it('shows the no-fill control as active when fillColor is transparent', () => {
    const el = makeElement({
      id: 'el-1',
      props: { ...makeElement().props, fillColor: 'transparent' },
    });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);

    expect(screen.getByRole('button', { name: /transparent fill/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('does not show fill color control for line element', () => {
    const el = makeElement({ id: 'el-1', type: 'line' });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    expect(screen.queryByLabelText(/fill color/i)).toBeNull();
  });
});

// @covers AC-5
describe('AC-5: stroke width change updates element', () => {
  it('calls patchElement with new strokeWidth as number', () => {
    const el = makeElement({ id: 'el-1' });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    fireEvent.change(screen.getByLabelText(/stroke width/i), { target: { value: '6' } });
    expect(patchSpy).toHaveBeenCalledWith('el-1', {
      props: { ...el.props, strokeWidth: 6 },
    });
  });
});

// @covers AC-6
describe('AC-6: opacity change updates element', () => {
  it('calls patchElement with opacity scaled to 0-1 range', () => {
    const el = makeElement({ id: 'el-1' });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    fireEvent.change(screen.getByLabelText(/opacity/i), { target: { value: '50' } });
    expect(patchSpy).toHaveBeenCalledWith('el-1', {
      props: { ...el.props, opacity: 0.5 },
    });
  });
});

// @covers AC-7
// @covers AC-5 (005-detail-panel-toolbar)
describe('AC-7: changes go through patchElement (mutation pipeline)', () => {
  it('patchElement is called exactly once per change', () => {
    const el = makeElement({ id: 'el-1' });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    fireEvent.change(screen.getByLabelText(/stroke color/i), { target: { value: '#ff0000' } });
    expect(patchSpy).toHaveBeenCalledTimes(1);
  });
});

// @covers AC-8
// @covers AC-6 (005-detail-panel-toolbar)
describe('AC-8: style values reflect current element props', () => {
  it('displays current strokeColor value from store', () => {
    const el = makeElement({
      id: 'el-1',
      props: { ...makeElement().props, strokeColor: '#ff0000' },
    });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    const input = screen.getByLabelText(/stroke color/i) as HTMLInputElement;
    expect(input.value).toBe('#ff0000');
  });

  it('displays current opacity value scaled to 0-100 from store', () => {
    const el = makeElement({ id: 'el-1', props: { ...makeElement().props, opacity: 0.4 } });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    const input = screen.getByLabelText(/opacity/i) as HTMLInputElement;
    expect(Number(input.value)).toBe(40);
  });
});

// @covers AC-9
describe('AC-9: text controls visible when text element selected', () => {
  it('shows font size and font family controls for text element', () => {
    const el = makeElement({ id: 'el-1', type: 'text', props: TEXT_PROPS });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    expect(screen.getByLabelText(/font size/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/font family/i)).toBeInTheDocument();
  });

  it('shows text alignment buttons for text element', () => {
    const el = makeElement({ id: 'el-1', type: 'text', props: TEXT_PROPS });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    expect(screen.getByRole('button', { name: /left/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /center/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /right/i })).toBeInTheDocument();
  });
});

// @covers AC-10
describe('AC-10: text controls hidden for non-text shapes', () => {
  it('does not show font size, font family, or alignment for rectangle', () => {
    const el = makeElement({ id: 'el-1', type: 'rectangle' });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    expect(screen.queryByLabelText(/font size/i)).toBeNull();
    expect(screen.queryByLabelText(/font family/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /center/i })).toBeNull();
  });
});

// @covers AC-11
describe('AC-11: fontSize change updates text element', () => {
  // makeElement defaults: width=100, height=50; TEXT_PROPS.fontSize=16
  // scale = 32/16 = 2 → new width=200, new height=100
  it('calls patchElement with new fontSize and proportionally scaled bbox', () => {
    const el = makeElement({ id: 'el-1', type: 'text', props: TEXT_PROPS });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    fireEvent.change(screen.getByLabelText(/font size/i), { target: { value: '32' } });
    expect(patchSpy).toHaveBeenCalledWith('el-1', {
      props: { ...TEXT_PROPS, fontSize: 32 },
      width: 200, // 100 * (32/16)
      height: 100, // 50 * (32/16)
    });
  });
});

// @covers AC-12
describe('AC-12: fontFamily change updates text element', () => {
  it('calls patchElement with new fontFamily and fitted bbox', () => {
    const el = makeElement({
      id: 'el-1',
      type: 'text',
      width: 1,
      height: 1,
      props: { ...TEXT_PROPS, text: 'WWWWWW' },
    });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    fireEvent.change(screen.getByLabelText(/font family/i), { target: { value: 'serif' } });
    const patch = patchSpy.mock.calls[0][1];
    expect(patchSpy).toHaveBeenCalledWith(
      'el-1',
      expect.objectContaining({
        props: { ...TEXT_PROPS, text: 'WWWWWW', fontFamily: 'serif' },
      }),
    );
    expect(patch.width).toBeGreaterThan(el.width);
    expect(patch.height).toBeGreaterThan(el.height);
  });

  // @covers AC-22 (003-style-and-text)
  // @covers AC-10 (009-inline-text-edit)
  it('calls patchElement with shrunken bbox when the new font is narrower', () => {
    const el = makeElement({
      id: 'el-1',
      type: 'text',
      width: 200,
      height: 80,
      props: { ...TEXT_PROPS, fontFamily: 'monospace', text: 'WWW' },
    });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    fireEvent.change(screen.getByLabelText(/font family/i), { target: { value: 'serif' } });
    const patch = patchSpy.mock.calls[0][1];
    expect(patchSpy).toHaveBeenCalledWith(
      'el-1',
      expect.objectContaining({
        props: { ...TEXT_PROPS, fontFamily: 'serif', text: 'WWW' },
      }),
    );
    expect(patch.width).toBeLessThan(el.width);
    expect(patch.height).toBeLessThan(el.height);
  });
});

// @covers AC-16
describe('AC-16: textAlign change updates text element via patchElement', () => {
  it('calls patchElement with textAlign="center" when center button clicked', () => {
    const el = makeElement({ id: 'el-1', type: 'text', props: TEXT_PROPS });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    fireEvent.click(screen.getByRole('button', { name: /center/i }));
    expect(patchSpy).toHaveBeenCalledWith('el-1', {
      props: { ...TEXT_PROPS, textAlign: 'center' },
    });
  });

  it('calls patchElement with textAlign="right" when right button clicked', () => {
    const el = makeElement({ id: 'el-1', type: 'text', props: TEXT_PROPS });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    fireEvent.click(screen.getByRole('button', { name: /right/i }));
    expect(patchSpy).toHaveBeenCalledWith('el-1', {
      props: { ...TEXT_PROPS, textAlign: 'right' },
    });
  });
});

// @covers AC-8 (persistence - fontSize)
describe('AC-8 (text): fontSize persists in panel after store update', () => {
  it('shows current fontSize from store', () => {
    const el = makeElement({ id: 'el-1', type: 'text', props: { ...TEXT_PROPS, fontSize: 24 } });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    const input = screen.getByLabelText(/font size/i) as HTMLInputElement;
    expect(Number(input.value)).toBe(24);
  });
});

// @covers AC-14 (008-rotate-resize)
describe('AC-14: angle field shows and edits rotation', () => {
  it('displays current angle in degrees rounded to nearest integer', () => {
    const el = makeElement({ id: 'el-1', angle: Math.PI / 2 }); // 90°
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    const input = screen.getByLabelText(/angle/i) as HTMLInputElement;
    expect(Number(input.value)).toBe(90);
  });

  it('calls patchElement with angle in radians when user changes the field', () => {
    const el = makeElement({ id: 'el-1', angle: 0 });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    render(<DetailPanel />);
    fireEvent.change(screen.getByLabelText(/angle/i), { target: { value: '45' } });
    const expectedRad = (45 * Math.PI) / 180;
    expect(patchSpy).toHaveBeenCalledWith('el-1', { angle: expectedRad });
  });
});

// @covers AC-7 (005-detail-panel-toolbar)
describe('AC-7 (005): panel pointerDown does not deselect shape', () => {
  it('selectedIds unchanged after pointerdown on panel root', () => {
    const el = makeElement({ id: 'el-1' });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['el-1']);
    const { container } = render(<DetailPanel />);
    const panelRoot = container.firstChild as HTMLElement;
    fireEvent.pointerDown(panelRoot);
    expect(useInteractionStore.getState().selectedIds).toEqual(['el-1']);
  });
});

// ─── Text — fontSize change scales bbox proportionally ───────────────────────

describe('text: fontSize change scales bbox proportionally', () => {
  function makeTextEl(overrides: Partial<Element> = {}): Element {
    return makeElement({
      type: 'text',
      width: 200,
      height: 40,
      props: {
        strokeColor: '#000000',
        fillColor: 'transparent',
        strokeWidth: 1,
        strokeStyle: 'solid',
        opacity: 1,
        fontSize: 16,
        fontFamily: 'sans-serif',
        textAlign: 'left',
        text: 'Hello',
      },
      ...overrides,
    });
  }

  it('doubling fontSize calls patchElement with doubled width and height', () => {
    const el = makeTextEl({ id: 'txt-1' });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['txt-1']);
    render(<DetailPanel />);

    fireEvent.change(screen.getByLabelText(/font size/i), { target: { value: '32' } });

    expect(patchSpy).toHaveBeenCalledWith(
      'txt-1',
      expect.objectContaining({
        props: expect.objectContaining({ fontSize: 32 }),
        width: 400, // 200 * (32/16)
        height: 80, // 40 * (32/16)
      }),
    );
  });

  it('halving fontSize calls patchElement with halved width and height', () => {
    const el = makeTextEl({ id: 'txt-2' });
    useElementsStore.setState({ elements: [el] });
    useInteractionStore.getState().setSelectedIds(['txt-2']);
    render(<DetailPanel />);

    fireEvent.change(screen.getByLabelText(/font size/i), { target: { value: '8' } });

    expect(patchSpy).toHaveBeenCalledWith(
      'txt-2',
      expect.objectContaining({
        props: expect.objectContaining({ fontSize: 8 }),
        width: 100, // 200 * (8/16)
        height: 20, // 40 * (8/16)
      }),
    );
  });
});
