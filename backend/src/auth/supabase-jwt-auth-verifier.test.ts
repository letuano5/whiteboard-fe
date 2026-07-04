import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AuthVerifyError, createSupabaseJwtAuthVerifier } from './index.js';

const jwtSecret = 'local-supabase-jwt-secret-with-enough-entropy';
const now = new Date('2026-06-30T12:00:00.000Z');

describe('createSupabaseJwtAuthVerifier', () => {
  it('verifies an HS256 Supabase JWT and maps identity claims', async () => {
    const verifier = createSupabaseJwtAuthVerifier({ jwtSecret, now: () => now });
    const token = signToken({
      sub: 'supabase-user-123',
      email: 'player@example.com',
      exp: seconds(now) + 60,
      user_metadata: {
        name: 'Tactical Player',
        avatar_url: 'https://example.test/avatar.png',
      },
    });

    await expect(verifier.verify({ bearerToken: token })).resolves.toEqual({
      provider: 'supabase',
      providerSubject: 'supabase-user-123',
      email: 'player@example.com',
      name: 'Tactical Player',
      avatarUrl: 'https://example.test/avatar.png',
    });
  });

  it('rejects missing credentials with the stable auth reason', async () => {
    const verifier = createSupabaseJwtAuthVerifier({ jwtSecret, now: () => now });

    await expect(verifier.verify({ bearerToken: null })).rejects.toMatchObject({
      reason: 'missing-credentials',
    } satisfies Partial<AuthVerifyError>);
  });

  it('rejects tampered or expired tokens', async () => {
    const verifier = createSupabaseJwtAuthVerifier({ jwtSecret, now: () => now });
    const expiredToken = signToken({
      sub: 'supabase-user-123',
      exp: seconds(now) - 1,
    });
    const tamperedToken = `${signToken({ sub: 'supabase-user-123', exp: seconds(now) + 60 })}x`;

    await expect(verifier.verify({ bearerToken: expiredToken })).rejects.toMatchObject({
      reason: 'invalid-credentials',
    } satisfies Partial<AuthVerifyError>);
    await expect(verifier.verify({ bearerToken: tamperedToken })).rejects.toMatchObject({
      reason: 'invalid-credentials',
    } satisfies Partial<AuthVerifyError>);
  });

  it('enforces audience when configured', async () => {
    const verifier = createSupabaseJwtAuthVerifier({
      jwtSecret,
      audience: 'authenticated',
      now: () => now,
    });
    const token = signToken({
      sub: 'supabase-user-123',
      aud: 'anon',
      exp: seconds(now) + 60,
    });

    await expect(verifier.verify({ bearerToken: token })).rejects.toMatchObject({
      reason: 'invalid-credentials',
    } satisfies Partial<AuthVerifyError>);
  });
});

function signToken(payload: Record<string, unknown>): string {
  const encodedHeader = encodePart({ alg: 'HS256', typ: 'JWT' });
  const encodedPayload = encodePart(payload);
  const signature = createHmac('sha256', jwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function encodePart(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function seconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
