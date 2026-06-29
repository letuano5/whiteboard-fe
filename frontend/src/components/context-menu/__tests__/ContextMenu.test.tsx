import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock zorder functions
vi.mock('../../../store/zorder', () => ({
  bringToFront: vi.fn(),
  sendToBack: vi.fn(),
  bringForward: vi.fn(),
  sendBackward: vi.fn(),
}));

import ContextMenu from '../ContextMenu';

beforeEach(() => {
  vi.clearAllMocks();
});

// @covers AC-7
describe('ContextMenu — AC-7: multi-select disables z-order controls', () => {
  it('AC-7: z-order buttons are disabled when selectedCount > 1', () => {
    const onClose = vi.fn();
    render(
      <ContextMenu
        x={100}
        y={100}
        selectedId="some-id"
        selectedCount={2}
        onClose={onClose}
      />,
    );

    const buttons = screen.getAllByRole('button');
    // All z-order buttons must be disabled when multiple elements selected
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('AC-7: z-order buttons are enabled when selectedCount === 1', () => {
    const onClose = vi.fn();
    render(
      <ContextMenu
        x={100}
        y={100}
        selectedId="some-id"
        selectedCount={1}
        onClose={onClose}
      />,
    );

    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).not.toBeDisabled();
    });
  });

  it('AC-7: z-order buttons are disabled when selectedCount === 0', () => {
    const onClose = vi.fn();
    render(
      <ContextMenu
        x={100}
        y={100}
        selectedId={null}
        selectedCount={0}
        onClose={onClose}
      />,
    );

    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});

describe('ContextMenu — z-order button labels', () => {
  it('renders all four z-order action buttons', () => {
    const onClose = vi.fn();
    render(
      <ContextMenu
        x={0}
        y={0}
        selectedId="el-1"
        selectedCount={1}
        onClose={onClose}
      />,
    );

    expect(screen.getByText(/bring to front/i)).toBeDefined();
    expect(screen.getByText(/forward/i)).toBeDefined();
    expect(screen.getByText(/backward/i)).toBeDefined();
    expect(screen.getByText(/send to back/i)).toBeDefined();
  });
});
