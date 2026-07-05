import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MoreToolsMenu from '../MoreToolsMenu';

describe('MoreToolsMenu', () => {
  it('is closed by default and opens the overflow panel when the trigger is clicked', () => {
    render(<MoreToolsMenu tool="select" chooseTool={vi.fn()} />);
    expect(screen.queryByTitle('Freehand')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle('More tools'));
    expect(screen.getByTitle('Freehand')).toBeInTheDocument();
  });

  it('calls chooseTool with the selected overflow tool id and closes the menu', () => {
    const chooseTool = vi.fn();
    render(<MoreToolsMenu tool="select" chooseTool={chooseTool} />);

    fireEvent.click(screen.getByTitle('More tools'));
    fireEvent.click(screen.getByTitle('Freehand'));

    expect(chooseTool).toHaveBeenCalledWith('freehand');
    expect(screen.queryByTitle('Freehand')).not.toBeInTheDocument();
  });

  it('closes the menu on outside click', () => {
    render(<MoreToolsMenu tool="select" chooseTool={vi.fn()} />);
    fireEvent.click(screen.getByTitle('More tools'));
    expect(screen.getByTitle('Freehand')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByTitle('Freehand')).not.toBeInTheDocument();
  });

  it('closes the menu on Escape', () => {
    render(<MoreToolsMenu tool="select" chooseTool={vi.fn()} />);
    fireEvent.click(screen.getByTitle('More tools'));
    expect(screen.getByTitle('Freehand')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTitle('Freehand')).not.toBeInTheDocument();
  });

  it('shows the active highlight on the trigger when the active tool is in the overflow set, even while closed', () => {
    render(<MoreToolsMenu tool="laser" chooseTool={vi.fn()} />);
    const trigger = screen.getByTitle('More tools') as HTMLButtonElement;
    expect(trigger.style.background).toBe('rgb(37, 99, 235)');
  });

  it('does not show the active highlight when the active tool is a fixed tool and the menu is closed', () => {
    render(<MoreToolsMenu tool="select" chooseTool={vi.fn()} />);
    const trigger = screen.getByTitle('More tools') as HTMLButtonElement;
    expect(trigger.style.background).toBe('transparent');
  });
});
