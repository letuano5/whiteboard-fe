import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

vi.mock('../../canvas/Whiteboard', () => ({
  default: ({ mode }: { mode: 'local' | 'saved' }) => (
    <div data-mode={mode} data-testid="whiteboard" />
  ),
}));
vi.mock('../../documents/DocumentDashboard', () => ({
  DocumentDashboard: () => <div data-testid="document-dashboard" />,
}));

function setLocation(pathname: string, search: string) {
  Object.defineProperty(window, 'location', {
    value: {
      ...window.location,
      pathname,
      search,
      href: `http://localhost:5173${pathname}${search}`,
    },
    writable: true,
  });
}

beforeEach(() => {
  setLocation('/', '');
});

describe('App local-board routing', () => {
  it('renders the root route as a local-only whiteboard', () => {
    // @covers AC-1
    // @covers AC-4
    setLocation('/', '');

    render(<App />);

    expect(screen.getByTestId('whiteboard')).toHaveAttribute('data-mode', 'local');
  });

  it('renders ?room=<uuid> as a saved-document whiteboard', () => {
    // @covers AC-6
    setLocation('/', '?room=test-room-id');

    render(<App />);

    expect(screen.getByTestId('whiteboard')).toHaveAttribute('data-mode', 'saved');
  });
});
