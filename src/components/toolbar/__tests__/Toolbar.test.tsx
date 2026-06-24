import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import Toolbar from '../Toolbar';
import { useInteractionStore } from '../../../store/interaction.store';

beforeEach(() => {
  useInteractionStore.getState().reset();
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
describe('AC-8 (005): toolbar shows exactly 6 tool buttons', () => {
  it('renders Select, Hand, Rectangle, Ellipse, Line, Text buttons', () => {
    render(<Toolbar />);
    const expectedTitles = ['Select', 'Hand', 'Rectangle', 'Ellipse', 'Line', 'Text'];
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(6);
    expectedTitles.forEach((title) => {
      expect(screen.getByTitle(title)).toBeInTheDocument();
    });
  });
});

// @covers AC-9 (005-detail-panel-toolbar)
describe('AC-9 (005): active tool is visually distinguished', () => {
  it('active tool button has different background from inactive tools', () => {
    useInteractionStore.setState({ tool: 'rectangle' } as Parameters<typeof useInteractionStore.setState>[0]);
    render(<Toolbar />);
    const activeBtn = screen.getByTitle('Rectangle') as HTMLButtonElement;
    const inactiveBtn = screen.getByTitle('Select') as HTMLButtonElement;
    expect(activeBtn.style.background).not.toBe(inactiveBtn.style.background);
  });
});
