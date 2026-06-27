import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Toolbar from '../Toolbar';
import { useInteractionStore } from '../../../store/interaction.store';
import * as laserTool from '../../../canvas/tools/laser-tool';

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
describe('AC-8 (005): toolbar shows tool buttons including laser', () => {
  it('renders Select, Hand, Rectangle, Ellipse, Line, Text, Laser buttons', () => {
    render(<Toolbar />);
    const expectedTitles = ['Select', 'Hand', 'Rectangle', 'Ellipse', 'Line', 'Text', 'Laser'];
    expectedTitles.forEach((title) => {
      expect(screen.getByTitle(title)).toBeInTheDocument();
    });
  });
});

// @covers AC-4 (011-laser-pointer)
describe('AC-4: laser tool button activates laser tool', () => {
  it('clicking Laser button sets tool to laser', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTitle('Laser'));
    expect(useInteractionStore.getState().tool).toBe('laser');
  });
});

// @covers AC-5 (011-laser-pointer)
describe('AC-5: switching away from laser clears trail immediately', () => {
  it('clicking another tool calls clearLaserTrail', () => {
    const clearSpy = vi.spyOn(laserTool, 'clearLaserTrail');
    useInteractionStore.setState({ tool: 'laser' } as Parameters<typeof useInteractionStore.setState>[0]);
    render(<Toolbar />);
    fireEvent.click(screen.getByTitle('Select'));
    expect(clearSpy).toHaveBeenCalled();
    expect(useInteractionStore.getState().tool).toBe('select');
    clearSpy.mockRestore();
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
