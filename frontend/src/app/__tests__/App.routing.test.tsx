import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock heavy canvas components to keep routing tests fast
vi.mock('../../canvas/Whiteboard', () => ({
  default: () => <div data-testid="whiteboard" />,
}));
vi.mock('../HomePage', () => ({
  default: () => <div data-testid="home-page" />,
}));
// Prevent socket-client from actually connecting in routing tests
vi.mock('../../sync/socket-client', () => ({
  initSocketClient: vi.fn(),
  stopSocketClient: vi.fn(),
}));

function setSearch(search: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search, href: `http://localhost:5173/${search}` },
    writable: true,
  });
}

beforeEach(() => {
  setSearch('');
});

describe('App routing — AC-1', () => {
  // @covers AC-1
  it('shows home screen when no ?room= param is present', () => {
    setSearch('');
    render(<App />);
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(screen.queryByTestId('whiteboard')).not.toBeInTheDocument();
  });
});

describe('App routing — AC-3', () => {
  // @covers AC-3
  it('shows canvas when ?room=<id> param is present', () => {
    setSearch('?room=test-room-id');
    render(<App />);
    expect(screen.getByTestId('whiteboard')).toBeInTheDocument();
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();
  });
});
