import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Whiteboard from '../Whiteboard';
import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import { useRoomAccessStore } from '../../rooms/room-access.store';
import { useAuthStore } from '../../auth/auth.store';

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
  useAuthStore.setState({
    session: null,
    status: 'anonymous',
    errorMessage: null,
    noticeMessage: null,
  });
});

describe('Whiteboard role permissions', () => {
  it('hides edit toolbar actions for viewers', () => {
    // @covers AC-5
    useRoomAccessStore.getState().setRoomAccess({
      roomId: 'room-1',
      role: 'viewer',
      baseRole: 'viewer',
      effectiveRole: 'viewer',
      visibility: 'private',
      shareRevokedAt: null,
      members: [],
      invitations: [],
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
      baseRole: 'editor',
      effectiveRole: 'editor',
      visibility: 'private',
      shareRevokedAt: null,
      members: [],
      invitations: [],
    });

    render(<Whiteboard />);

    expect(screen.getByTitle('Rectangle')).toBeInTheDocument();
    expect(screen.getByTitle('Text')).toBeInTheDocument();
  });

  it('shows account controls beside Share on saved boards', () => {
    useRoomAccessStore.getState().setRoomAccess({
      roomId: 'room-1',
      role: 'owner',
      baseRole: 'owner',
      effectiveRole: 'owner',
      visibility: 'private',
      shareRevokedAt: null,
      members: [],
      invitations: [],
    });

    render(<Whiteboard mode="saved" />);

    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('shows dashboard navigation on saved boards', async () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      writable: true,
    });

    render(<Whiteboard mode="saved" />);
    fireEvent.click(screen.getByRole('button', { name: /open dashboard/i }));

    // Navigation now waits for any pending sync commands to settle first, then
    // pushes the route without a full page reload.
    await waitFor(() => expect(pushStateSpy).toHaveBeenCalledWith({}, '', '/dashboard'));
    expect(reload).not.toHaveBeenCalled();
  });
});
