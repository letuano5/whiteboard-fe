export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export interface AuthSession {
  accessToken: string;
  expiresAt: number | null;
  user: AuthUser;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthAdapter {
  getSession(): Promise<AuthSession | null>;
  refreshSession(): Promise<AuthSession | null>;
  signInWithPassword(credentials: AuthCredentials): Promise<AuthSession | null>;
  signUpWithPassword(credentials: AuthCredentials): Promise<AuthSession | null>;
  signOut(): Promise<void>;
  onSessionChange(listener: (session: AuthSession | null) => void): () => void;
}

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthConfigurationError';
  }
}
