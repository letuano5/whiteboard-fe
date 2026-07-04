import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';

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
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().reset();
});

// @covers AC-7
describe('ContextMenu — AC-7: multi-select disables z-order controls', () => {
  it('AC-7: z-order buttons are disabled when selectedCount > 1', () => {
    const onClose = vi.fn();
    render(
      <ContextMenu x={100} y={100} selectedId="some-id" selectedCount={2} onClose={onClose} />,
    );

    const buttons = screen.getAllByRole('button');
    // All z-order buttons must be disabled when multiple elements selected
    buttons.slice(0, 4).forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('AC-7: z-order buttons are enabled when selectedCount === 1', () => {
    const onClose = vi.fn();
    render(
      <ContextMenu x={100} y={100} selectedId="some-id" selectedCount={1} onClose={onClose} />,
    );

    const buttons = screen.getAllByRole('button');
    buttons.slice(0, 4).forEach((btn) => {
      expect(btn).not.toBeDisabled();
    });
  });

  it('AC-7: z-order buttons are disabled when selectedCount === 0', () => {
    const onClose = vi.fn();
    render(<ContextMenu x={100} y={100} selectedId={null} selectedCount={0} onClose={onClose} />);

    const buttons = screen.getAllByRole('button');
    buttons.slice(0, 4).forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});

describe('ContextMenu — z-order button labels', () => {
  it('renders all four z-order action buttons', () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} selectedId="el-1" selectedCount={1} onClose={onClose} />);

    expect(screen.getByText(/bring to front/i)).toBeDefined();
    expect(screen.getByText(/forward/i)).toBeDefined();
    expect(screen.getByText(/backward/i)).toBeDefined();
    expect(screen.getByText(/send to back/i)).toBeDefined();
  });
});

describe('ContextMenu — Merge and Unmerge rows', () => {
  it('@covers AC-1 @covers AC-2 renders Merge and Unmerge below z-order rows', () => {
    useElementsStore.getState().setElements([
      {
        id: 'a',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        angle: 0,
        zIndex: 0,
        props: {
          strokeColor: '#000',
          fillColor: 'transparent',
          strokeWidth: 1,
          strokeStyle: 'solid',
          opacity: 1,
        },
        version: 1,
        versionNonce: 1,
        updatedAt: 0,
        isDeleted: false,
        groupId: null,
        frameId: null,
        locked: false,
        createdBy: 'test',
      },
      {
        id: 'b',
        type: 'rectangle',
        x: 20,
        y: 0,
        width: 10,
        height: 10,
        angle: 0,
        zIndex: 1,
        props: {
          strokeColor: '#000',
          fillColor: 'transparent',
          strokeWidth: 1,
          strokeStyle: 'solid',
          opacity: 1,
        },
        version: 1,
        versionNonce: 1,
        updatedAt: 0,
        isDeleted: false,
        groupId: null,
        frameId: null,
        locked: false,
        createdBy: 'test',
      },
    ]);
    useInteractionStore.getState().setSelectedIds(['a', 'b']);

    render(<ContextMenu x={0} y={0} selectedId="a" selectedCount={2} onClose={vi.fn()} />);

    expect(screen.getByText('Merge')).not.toBeDisabled();
    expect(screen.getByText('Unmerge')).toBeDisabled();
  });
});

describe('ContextMenu — Lock/Unlock row', () => {
  function elementFixture(overrides: Partial<{ id: string; locked: boolean }>) {
    return {
      id: overrides.id ?? 'a',
      type: 'rectangle' as const,
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      angle: 0,
      zIndex: 0,
      props: {
        strokeColor: '#000',
        fillColor: 'transparent',
        strokeWidth: 1,
        strokeStyle: 'solid' as const,
        opacity: 1,
      },
      version: 1,
      versionNonce: 1,
      updatedAt: 0,
      isDeleted: false,
      groupId: null,
      frameId: null,
      locked: overrides.locked ?? false,
      createdBy: 'test',
    };
  }

  it('shows "Lock" and enables it when a non-locked element is selected', () => {
    useElementsStore.getState().setElements([elementFixture({ id: 'a', locked: false })]);
    useInteractionStore.getState().setSelectedIds(['a']);

    render(<ContextMenu x={0} y={0} selectedId="a" selectedCount={1} onClose={vi.fn()} />);

    expect(screen.getByText('Lock')).not.toBeDisabled();
  });

  it('shows "Unlock" when every selected element is already locked', () => {
    useElementsStore.getState().setElements([elementFixture({ id: 'a', locked: true })]);
    useInteractionStore.getState().setSelectedIds(['a']);

    render(<ContextMenu x={0} y={0} selectedId="a" selectedCount={1} onClose={vi.fn()} />);

    expect(screen.getByText('Unlock')).not.toBeDisabled();
  });

  it('disables the lock row when nothing is selected', () => {
    useInteractionStore.getState().setSelectedIds([]);

    render(<ContextMenu x={0} y={0} selectedId={null} selectedCount={0} onClose={vi.fn()} />);

    expect(screen.getByText('Lock')).toBeDisabled();
  });
});
