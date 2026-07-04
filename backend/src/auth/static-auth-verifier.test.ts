import { describe, expect, it } from 'vitest';
import { AuthVerifyError, createStaticAuthVerifier, type VerifiedIdentity } from './index.js';

const identity: VerifiedIdentity = {
  provider: 'supabase',
  providerSubject: 'user-123',
  email: 'player@example.com',
  name: 'Tactical Player',
  avatarUrl: 'https://example.com/avatar.png',
};

function setup() {
  return createStaticAuthVerifier({
    provider: 'supabase',
    identitiesByToken: new Map([['valid-token', identity]]),
  });
}

describe('createStaticAuthVerifier', () => {
  it('returns a normalized identity for a valid token', async () => {
    const verifier = setup();

    await expect(verifier.verify({ bearerToken: 'valid-token' })).resolves.toEqual({
      provider: 'supabase',
      providerSubject: 'user-123',
      email: 'player@example.com',
      name: 'Tactical Player',
      avatarUrl: 'https://example.com/avatar.png',
    });
  });

  it('rejects missing credentials with a typed failure', async () => {
    const verifier = setup();

    await expect(verifier.verify({ bearerToken: null })).rejects.toMatchObject({
      reason: 'missing-credentials',
    } satisfies Partial<AuthVerifyError>);
  });

  it('rejects unknown tokens with a typed failure', async () => {
    const verifier = setup();

    await expect(verifier.verify({ bearerToken: 'unknown-token' })).rejects.toMatchObject({
      reason: 'invalid-credentials',
    } satisfies Partial<AuthVerifyError>);
  });

  it('keeps authentication identity separate from room authorization', async () => {
    const verifier = setup();

    const verified = await verifier.verify({ bearerToken: 'valid-token' });

    expect(verified).not.toHaveProperty('role');
    expect(verified).not.toHaveProperty('roomId');
    expect(verified).not.toHaveProperty('roomMembership');
  });
});
