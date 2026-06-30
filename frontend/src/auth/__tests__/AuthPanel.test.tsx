import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthPanel } from '../AuthPanel';
import { createAuthStore } from '../auth.store';
import type { AuthAdapter, AuthSession } from '../types';

const session: AuthSession = {
  accessToken: 'access-token-123',
  expiresAt: 123456,
  user: {
    id: 'user-123',
    email: 'player@example.com',
    name: 'Tactical Player',
    avatarUrl: null,
  },
};

function getSignInSubmitButton(): HTMLElement {
  const buttons = screen.getAllByRole('button', { name: /^sign in$/i });
  return buttons[buttons.length - 1];
}

function createAdapter(overrides: Partial<AuthAdapter> = {}) {
  const adapter: AuthAdapter = {
    getSession: vi.fn().mockResolvedValue(null),
    refreshSession: vi.fn().mockResolvedValue(null),
    signInWithPassword: vi.fn().mockResolvedValue(session),
    signUpWithPassword: vi.fn().mockResolvedValue(session),
    signOut: vi.fn().mockResolvedValue(undefined),
    onSessionChange: vi.fn(() => vi.fn()),
    ...overrides,
  };

  return adapter;
}

describe('AuthPanel', () => {
  it('restores session on mount and logs in with email/password', async () => {
    const adapter = createAdapter();
    const useStore = createAuthStore(() => adapter);

    render(<AuthPanel useStore={useStore} />);

    await waitFor(() => expect(adapter.getSession).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'player@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'secret' },
    });
    fireEvent.click(getSignInSubmitButton());

    await waitFor(() =>
      expect(adapter.signInWithPassword).toHaveBeenCalledWith({
        email: 'player@example.com',
        password: 'secret',
      }),
    );
    expect(await screen.findByText('Tactical Player')).toBeInTheDocument();
  });

  it('registers a new account with email/password', async () => {
    const adapter = createAdapter();
    const useStore = createAuthStore(() => adapter);

    render(<AuthPanel useStore={useStore} />);

    await waitFor(() => expect(adapter.getSession).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: /register/i }));
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'player@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(adapter.signUpWithPassword).toHaveBeenCalledWith({
        email: 'player@example.com',
        password: 'secret',
      }),
    );
    expect(await screen.findByText('Tactical Player')).toBeInTheDocument();
  });

  it('shows a confirmation notice when registration creates no immediate session', async () => {
    const adapter = createAdapter({
      signUpWithPassword: vi.fn().mockResolvedValue(null),
    });
    const useStore = createAuthStore(() => adapter);

    render(<AuthPanel useStore={useStore} />);

    await waitFor(() => expect(adapter.getSession).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: /register/i }));
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'player@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Account created. Check your email to confirm it before signing in.',
    );
  });

  it('shows current session and signs out', async () => {
    const adapter = createAdapter({
      getSession: vi.fn().mockResolvedValue(session),
    });
    const useStore = createAuthStore(() => adapter);

    render(<AuthPanel useStore={useStore} />);

    expect(await screen.findByText('Tactical Player')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(adapter.signOut).toHaveBeenCalledOnce());
    expect(await screen.findAllByRole('button', { name: /^sign in$/i })).toHaveLength(2);
  });

  it('shows auth errors without hiding the login form', async () => {
    const adapter = createAdapter({
      getSession: vi.fn().mockRejectedValue(new Error('Supabase auth is not configured.')),
    });
    const useStore = createAuthStore(() => adapter);

    render(<AuthPanel useStore={useStore} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Supabase auth is not configured.');
    expect(screen.getAllByRole('button', { name: /^sign in$/i })).toHaveLength(2);
  });
});
