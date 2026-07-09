import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthMenu } from '../AuthMenu';
import { useAuthStore } from '../auth.store';

vi.mock('../AuthPanel', () => ({
  AuthPanel: () => <div data-testid="auth-panel" />,
}));

const signOut = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    session: null,
    status: 'anonymous',
    errorMessage: null,
    noticeMessage: null,
    signOut,
  });
});

describe('AuthMenu', () => {
  it('shows a Login button for anonymous users', () => {
    render(<AuthMenu />);

    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(screen.getByTestId('auth-panel')).toBeInTheDocument();
  });

  it('closes the Login panel when clicking outside', () => {
    render(<AuthMenu />);

    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    expect(screen.getByTestId('auth-panel')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByTestId('auth-panel')).not.toBeInTheDocument();
  });

  it('shows an avatar menu with Sign out for authenticated users', async () => {
    useAuthStore.setState({
      session: {
        accessToken: 'access-token',
        expiresAt: null,
        user: {
          id: 'user-1',
          email: 'owner@example.com',
          name: 'Owner User',
          avatarUrl: null,
        },
      },
      status: 'authenticated',
      signOut,
    });

    render(<AuthMenu />);
    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
  });
});
