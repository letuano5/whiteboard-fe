import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import Toolbar from '../Toolbar';
import { useInteractionStore } from '../../../store/interaction.store';

beforeEach(() => {
  useInteractionStore.getState().reset();
});

// @covers AC-8 (001-select-shape)
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
