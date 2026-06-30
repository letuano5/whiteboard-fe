export interface VerifiedIdentity {
  provider: string;
  providerSubject: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export type AuthVerifyFailureReason = 'missing-credentials' | 'invalid-credentials';

export class AuthVerifyError extends Error {
  constructor(
    public readonly reason: AuthVerifyFailureReason,
    message: string,
  ) {
    super(message);
    this.name = 'AuthVerifyError';
  }
}

export interface AuthVerifyRequest {
  bearerToken: string | null;
}

export interface AuthVerifier {
  verify(request: AuthVerifyRequest): Promise<VerifiedIdentity>;
}
