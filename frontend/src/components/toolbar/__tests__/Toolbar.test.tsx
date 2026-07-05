import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Toolbar from '../Toolbar';
import { insertImageFromSource } from '../image-insert';
import { useInteractionStore } from '../../../store/interaction.store';
import { useElementsStore } from '../../../store/elements.store';
import * as laserTool from '../../../canvas/tools/laser-tool';
import {
  onHighlighterPointerDown,
  onHighlighterPointerMove,
} from '../../../canvas/tools/freehand-tool';

beforeEach(() => {
  useInteractionStore.getState().reset();
  useElementsStore.getState().setElements([]);
});

// @covers AC-8 (001-select-shape)
// @covers AC-10 (005-detail-panel-toolbar)
// @covers AC-11 (005-detail-panel-toolbar)
// @covers AC-12 (005-detail-panel-toolbar)
describe('Toolbar tool selection', () => {
  it('clears selected element and transient interaction state when choosing a tool', () => {
    const store = useInteractionStore.getState();
    store.setSelectedIds(['shape-1']);
    store.setDraggingId('shape-1');
    store.setDragStart({ x: 10, y: 20 });
    store.setResizeHandle('se');
    store.setResizeSession({
      originalBounds: { x: 0, y: 0, width: 100, height: 50 },
      originalHandle: 'se',
      anchor: { x: 0, y: 0 },
    });

    render(<Toolbar />);
    fireEvent.click(screen.getByTitle('Rectangle'));

    expect(useInteractionStore.getState().tool).toBe('rectangle');
    expect(useInteractionStore.getState().selectedIds).toEqual([]);
    expect(useInteractionStore.getState().draggingId).toBeNull();
    expect(useInteractionStore.getState().dragStart).toBeNull();
    expect(useInteractionStore.getState().resizeHandle).toBeNull();
    expect(useInteractionStore.getState().resizeSession).toBeNull();
  });
});

// @covers AC-8 (005-detail-panel-toolbar)
// @covers AC-1
describe('AC-8 (005): toolbar shows tool buttons including laser', () => {
  it('@covers AC-1 (049-mobile-responsive-pan-zoom): toolbar row is viewport-clamped and horizontally scrollable', () => {
    const { container } = render(<Toolbar />);
    const root = container.firstElementChild as HTMLElement;

    expect(root).toHaveClass('toolbar-scroll');
    expect(root).toHaveClass('max-w-[calc(100vw-16px)]');
    expect(root).toHaveClass('overflow-x-auto');
    expect(root.style.scrollbarWidth).toBe('none');
    expect(root.style.bottom).toBe('calc(16px + env(safe-area-inset-bottom))');
  });

  it('renders the fixed tools, Image, and the More tools trigger', () => {
    render(<Toolbar />);
    const expectedTitles = [
      'Select',
      'Rectangle',
      'Ellipse',
      'Line',
      'Text',
      'Eraser',
      'Image',
      'More tools',
    ];
    expectedTitles.forEach((title) => {
      expect(screen.getByTitle(title)).toBeInTheDocument();
    });
  });

  it('renders overflow tools (Hand, Diamond, Triangle, Polygon, Freehand, Highlighter, Laser) inside the More tools menu', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTitle('More tools'));
    const overflowTitles = [
      'Hand',
      'Diamond',
      'Triangle',
      'Polygon',
      'Freehand',
      'Highlighter',
      'Laser',
    ];
    overflowTitles.forEach((title) => {
      expect(screen.getByTitle(title)).toBeInTheDocument();
    });
  });
});

describe('image insertion control', () => {
  // @covers AC-1 (046-image-background)
  // @covers AC-4 (046-image-background)
  it('inserts a URL image element below existing visible elements', () => {
    useElementsStore.getState().setElements([
      {
        id: 'shape-1',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        angle: 0,
        zIndex: 5,
        props: {
          strokeColor: '#000',
          fillColor: '#fff',
          strokeWidth: 1,
          strokeStyle: 'solid',
          opacity: 1,
        },
        version: 1,
        versionNonce: 1,
        updatedAt: 1,
        isDeleted: false,
        groupId: null,
        frameId: null,
        locked: false,
        createdBy: 'test',
      },
    ]);

    insertImageFromSource('https://example.com/map.png');

    const image = useElementsStore.getState().elements.find((element) => element.type === 'image');
    expect(image).toMatchObject({
      type: 'image',
      zIndex: 4,
      props: expect.objectContaining({ src: 'https://example.com/map.png' }),
    });
    expect(useInteractionStore.getState().selectedIds).toEqual([image?.id]);
  });

  // @covers AC-2 (046-image-background)
  it('inserts an uploaded data URL image element', () => {
    insertImageFromSource('data:image/png;base64,AAAA');

    const image = useElementsStore.getState().elements.find((element) => element.type === 'image');
    expect(image?.props.src).toBe('data:image/png;base64,AAAA');
  });
});

// @covers AC-1
describe('freehand tool button', () => {
  it('clicking Freehand sets tool to freehand', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTitle('More tools'));
    fireEvent.click(screen.getByTitle('Freehand'));
    expect(useInteractionStore.getState().tool).toBe('freehand');
  });
});

// @covers AC-4
describe('highlighter tool button', () => {
  it('clicking Highlighter sets tool to highlighter', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTitle('More tools'));
    fireEvent.click(screen.getByTitle('Highlighter'));
    expect(useInteractionStore.getState().tool).toBe('highlighter');
  });

  it('switching away from Highlighter clears the in-progress draft', () => {
    onHighlighterPointerDown({ x: 0, y: 0 });
    onHighlighterPointerMove({ x: 10, y: 10 });
    expect(useInteractionStore.getState().draftElement?.type).toBe('highlighter');

    render(<Toolbar />);
    fireEvent.click(screen.getByTitle('Select'));

    expect(useInteractionStore.getState().tool).toBe('select');
    expect(useInteractionStore.getState().draftElement).toBeNull();
    expect(useInteractionStore.getState().dragStart).toBeNull();
  });
});

// @covers AC-1 (044-p3c-04-eraser)
describe('eraser tool button', () => {
  it('clicking Eraser sets tool to eraser', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTitle('Eraser'));
    expect(useInteractionStore.getState().tool).toBe('eraser');
  });
});

// @covers AC-4 (011-laser-pointer)
describe('AC-4: laser tool button activates laser tool', () => {
  it('clicking Laser button sets tool to laser', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTitle('More tools'));
    fireEvent.click(screen.getByTitle('Laser'));
    expect(useInteractionStore.getState().tool).toBe('laser');
  });
});

// @covers AC-5 (011-laser-pointer)
describe('AC-5: switching away from laser clears trail immediately', () => {
  it('clicking another tool calls clearLaserTrail', () => {
    const clearSpy = vi.spyOn(laserTool, 'clearLaserTrail');
    useInteractionStore.setState({ tool: 'laser' } as Parameters<
      typeof useInteractionStore.setState
    >[0]);
    render(<Toolbar />);
    fireEvent.click(screen.getByTitle('Select'));
    expect(clearSpy).toHaveBeenCalled();
    expect(useInteractionStore.getState().tool).toBe('select');
    clearSpy.mockRestore();
  });
});

describe('More tools trigger active state', () => {
  it('shows the active highlight when the active tool is inside the overflow menu', () => {
    useInteractionStore.setState({ tool: 'laser' } as Parameters<
      typeof useInteractionStore.setState
    >[0]);
    render(<Toolbar />);
    const moreBtn = screen.getByTitle('More tools') as HTMLButtonElement;
    const selectBtn = screen.getByTitle('Select') as HTMLButtonElement;
    expect(moreBtn).toHaveClass('bg-primary');
    expect(selectBtn).not.toHaveClass('bg-primary');
  });

  it('does not show the active highlight when the active tool is a fixed tool', () => {
    useInteractionStore.setState({ tool: 'select' } as Parameters<
      typeof useInteractionStore.setState
    >[0]);
    render(<Toolbar />);
    const moreBtn = screen.getByTitle('More tools') as HTMLButtonElement;
    const inactiveBtn = screen.getByTitle('Rectangle') as HTMLButtonElement;
    expect(moreBtn).not.toHaveClass('bg-primary');
    expect(inactiveBtn).not.toHaveClass('bg-primary');
  });
});

// @covers AC-9 (005-detail-panel-toolbar)
describe('AC-9 (005): active tool is visually distinguished', () => {
  it('active tool button has different background from inactive tools', () => {
    useInteractionStore.setState({ tool: 'rectangle' } as Parameters<
      typeof useInteractionStore.setState
    >[0]);
    render(<Toolbar />);
    const activeBtn = screen.getByTitle('Rectangle') as HTMLButtonElement;
    const inactiveBtn = screen.getByTitle('Select') as HTMLButtonElement;
    expect(activeBtn).toHaveClass('bg-primary');
    expect(inactiveBtn).not.toHaveClass('bg-primary');
  });
});
