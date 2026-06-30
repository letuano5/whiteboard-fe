import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Whiteboard from '../Whiteboard';
import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import { useRoomAccessStore } from '../../rooms/room-access.store';

vi.mock('../layers/SvgLayer', () => ({
  default: () => <svg data-testid="svg-layer" />,
}));

vi.mock('../layers/CursorOverlay', () => ({
  default: () => <div data-testid="cursor-overlay" />,
}));

beforeEach(() => {
  useElementsStore.setState({ elements: [] });
  useInteractionStore.getState().reset();
  useRoomAccessStore.getState().resetRoomAccess();
});

describe('Whiteboard role permissions', () => {
  it('hides edit toolbar actions for viewers', () => {
    useRoomAccessStore.getState().setRoomAccess({
      roomId: 'room-1',
      role: 'viewer',
      members: [],
    });

    render(<Whiteboard />);

    expect(screen.getByTestId('svg-layer')).toBeInTheDocument();
    expect(screen.queryByTitle('Rectangle')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Text')).not.toBeInTheDocument();
  });

  it('keeps edit toolbar visible for editors', () => {
    useRoomAccessStore.getState().setRoomAccess({
      roomId: 'room-1',
      role: 'editor',
      members: [],
    });

    render(<Whiteboard />);

    expect(screen.getByTitle('Rectangle')).toBeInTheDocument();
    expect(screen.getByTitle('Text')).toBeInTheDocument();
  });
});
