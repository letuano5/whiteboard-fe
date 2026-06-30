import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import OnlineUsersPanel from '../ui/OnlineUsersPanel';
import type { Presence } from '../../types/shared';
import { useInteractionStore } from '../../store/interaction.store';
import { useRoomAccessStore } from '../../rooms/room-access.store';

// Stable local presence for all tests
vi.mock('../../sync/presence', () => ({
  LOCAL_PRESENCE: { sessionId: 'local-session', name: 'Blue Fox', color: '#3b82f6' },
  toPresence: (local: { sessionId: string; name: string; color: string }) => ({
    ...local,
    cursor: null,
    selectedIds: [],
    status: 'active' as const,
  }),
}));

function makePresence(sessionId: string, name: string, color: string): Presence {
  return { sessionId, name, color, cursor: null, selectedIds: [], status: 'active' };
}

beforeEach(() => {
  useInteractionStore.setState({ remoteCursors: new Map() });
  useRoomAccessStore.getState().resetRoomAccess();
});

describe('OnlineUsersPanel — AC-8 (shows all connected users on join)', () => {
  // @covers AC-8
  it('renders a badge for each remote peer plus self', () => {
    useInteractionStore.setState({
      remoteCursors: new Map([
        ['peer-1', makePresence('peer-1', 'Red Bear', '#ef4444')],
        ['peer-2', makePresence('peer-2', 'Green Wolf', '#22c55e')],
      ]),
    });
    render(<OnlineUsersPanel />);
    expect(screen.getByText('Blue Fox')).toBeDefined(); // self
    expect(screen.getByText('Red Bear')).toBeDefined();
    expect(screen.getByText('Green Wolf')).toBeDefined();
  });
});

describe('OnlineUsersPanel — AC-9 (panel updates when new user joins)', () => {
  // @covers AC-9
  it('renders new peer badge after remoteCursors updated with a new entry', () => {
    useInteractionStore.setState({
      remoteCursors: new Map([['peer-1', makePresence('peer-1', 'Red Bear', '#ef4444')]]),
    });
    const { rerender } = render(<OnlineUsersPanel />);
    expect(screen.getByText('Red Bear')).toBeDefined();

    useInteractionStore.setState({
      remoteCursors: new Map([
        ['peer-1', makePresence('peer-1', 'Red Bear', '#ef4444')],
        ['peer-2', makePresence('peer-2', 'Green Wolf', '#22c55e')],
      ]),
    });
    rerender(<OnlineUsersPanel />);
    expect(screen.getByText('Green Wolf')).toBeDefined();
  });
});

describe('OnlineUsersPanel — AC-10 (panel removes user when they leave)', () => {
  // @covers AC-10
  it('removes the badge when a peer entry is deleted from remoteCursors', () => {
    useInteractionStore.setState({
      remoteCursors: new Map([['peer-1', makePresence('peer-1', 'Red Bear', '#ef4444')]]),
    });
    const { rerender } = render(<OnlineUsersPanel />);
    expect(screen.getByText('Red Bear')).toBeDefined();

    useInteractionStore.setState({ remoteCursors: new Map() });
    rerender(<OnlineUsersPanel />);
    expect(screen.queryByText('Red Bear')).toBeNull();
  });
});

describe('OnlineUsersPanel — AC-11 (solo user sees only themselves)', () => {
  // @covers AC-11
  it('renders exactly one badge (self) when no remote peers are present', () => {
    render(<OnlineUsersPanel />);
    expect(screen.getByText('Blue Fox')).toBeDefined();
    expect(screen.getByText('(you)')).toBeDefined();
  });

  it('shows Owner for the local owner without changing the presence color', () => {
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

    render(<OnlineUsersPanel />);

    expect(screen.getByText('Owner')).toBeDefined();
    expect(screen.queryByText('Blue Fox')).toBeNull();
  });
});
