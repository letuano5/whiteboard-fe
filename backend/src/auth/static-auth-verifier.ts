import { AuthVerifyError, type AuthVerifier, type VerifiedIdentity } from './types.js';

export interface StaticAuthVerifierOptions {
  provider: string;
  identitiesByToken: ReadonlyMap<string, VerifiedIdentity>;
}

export function createStaticAuthVerifier(options: StaticAuthVerifierOptions): AuthVerifier {
  return {
    async verify({ bearerToken }) {
      if (!bearerToken) {
        throw new AuthVerifyError('missing-credentials', 'Missing bearer token.');
      }

      const identity = options.identitiesByToken.get(bearerToken);

      if (!identity || identity.provider !== options.provider) {
        throw new AuthVerifyError('invalid-credentials', 'Bearer token is invalid.');
      }

      return identity;
    },
  };
}
