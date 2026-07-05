import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ActionToolbar from '../ActionToolbar';
import { useInteractionStore } from '../../../store/interaction.store';
import { useElementsStore } from '../../../store/elements.store';
import { useHistoryStore } from '../../../store/history.store';
import { useCameraStore } from '../../../store/camera.store';
import * as clipboardModule from '../../../canvas/tools/select/clipboard';
import * as deleteModule from '../../../canvas/tools/select/delete';

beforeEach(() => {
  useInteractionStore.getState().reset();
  useElementsStore.getState().setElements([]);
  useHistoryStore.getState().clear();
  useCameraStore.getState().resetCamera();
});

describe('ActionToolbar', () => {
  it('@covers AC-1 (049-mobile-responsive-pan-zoom): action row is viewport-clamped and horizontally scrollable', () => {
    const { container } = render(<ActionToolbar />);
    const root = container.firstElementChild as HTMLElement;

    expect(root).toHaveClass('toolbar-scroll');
    expect(root.style.maxWidth).toBe('calc(100vw - 16px)');
    expect(root.style.overflowX).toBe('auto');
    expect(root.style.scrollbarWidth).toBe('none');
    expect(root.style.bottom).toBe('calc(72px + env(safe-area-inset-bottom))');
  });

  it('renders Undo, Redo, Duplicate, Delete, and Reset zoom controls', () => {
    render(<ActionToolbar />);
    ['Undo', 'Redo', 'Duplicate', 'Delete', 'Reset zoom'].forEach((title) => {
      expect(screen.getByTitle(title)).toBeInTheDocument();
    });
  });
});

describe('undo/redo buttons', () => {
  it('Undo is disabled when history is empty', () => {
    render(<ActionToolbar />);
    expect((screen.getByTitle('Undo') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Redo is disabled when redo stack is empty', () => {
    render(<ActionToolbar />);
    expect((screen.getByTitle('Redo') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Undo is enabled and pops the undo stack when history exists', () => {
    useHistoryStore.setState({
      undoStack: [{ before: [], after: [], mutationType: 'create' }],
    });
    render(<ActionToolbar />);
    const undoBtn = screen.getByTitle('Undo') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(false);
    fireEvent.click(undoBtn);
    expect(useHistoryStore.getState().undoStack.length).toBe(0);
    expect(useHistoryStore.getState().redoStack.length).toBe(1);
  });

  it('Redo is enabled and pops the redo stack when redo entries exist', () => {
    useHistoryStore.setState({
      redoStack: [{ before: [], after: [], mutationType: 'create' }],
    });
    render(<ActionToolbar />);
    const redoBtn = screen.getByTitle('Redo') as HTMLButtonElement;
    expect(redoBtn.disabled).toBe(false);
    fireEvent.click(redoBtn);
    expect(useHistoryStore.getState().redoStack.length).toBe(0);
    expect(useHistoryStore.getState().undoStack.length).toBe(1);
  });
});

describe('duplicate/delete buttons', () => {
  it('Duplicate and Delete are disabled when nothing is selected', () => {
    render(<ActionToolbar />);
    expect((screen.getByTitle('Duplicate') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTitle('Delete') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Duplicate is enabled and invokes onDuplicateSelected when something is selected', () => {
    const duplicateSpy = vi.spyOn(clipboardModule, 'onDuplicateSelected');
    useInteractionStore.getState().setSelectedIds(['shape-1']);
    render(<ActionToolbar />);
    const duplicateBtn = screen.getByTitle('Duplicate') as HTMLButtonElement;
    expect(duplicateBtn.disabled).toBe(false);
    fireEvent.click(duplicateBtn);
    expect(duplicateSpy).toHaveBeenCalledTimes(1);
    duplicateSpy.mockRestore();
  });

  it('Delete is enabled and invokes onDeleteSelected when something is selected', () => {
    const deleteSpy = vi.spyOn(deleteModule, 'onDeleteSelected');
    useInteractionStore.getState().setSelectedIds(['shape-1']);
    render(<ActionToolbar />);
    const deleteBtn = screen.getByTitle('Delete') as HTMLButtonElement;
    expect(deleteBtn.disabled).toBe(false);
    fireEvent.click(deleteBtn);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    deleteSpy.mockRestore();
  });
});

describe('zoom control', () => {
  it('displays the rounded zoom percentage', () => {
    useCameraStore.setState({ camera: { x: 0, y: 0, zoom: 1.5 } });
    render(<ActionToolbar />);
    expect(screen.getByTitle('Reset zoom').textContent).toBe('150%');
  });

  it('clicking resets the camera to default', () => {
    useCameraStore.setState({ camera: { x: 40, y: 20, zoom: 2 } });
    render(<ActionToolbar />);
    fireEvent.click(screen.getByTitle('Reset zoom'));
    expect(useCameraStore.getState().camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});
