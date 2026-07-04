import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  AuthVerifyError,
  createHttpAuthMiddleware,
  type AppUser,
  type AppUserRepository,
  type AuthErrorResponse,
  type AuthVerifier,
  type VerifiedIdentity,
} from './index.js';

const identity: VerifiedIdentity = {
  provider: 'supabase',
  providerSubject: 'user-123',
  email: 'player@example.com',
  name: 'Tactical Player',
  avatarUrl: null,
};

const appUser: AppUser = {
  id: 'app-user-123',
  provider: 'supabase',
  providerSubject: 'user-123',
  email: 'player@example.com',
  name: 'Tactical Player',
  avatarUrl: null,
  createdAt: new Date('2026-06-30T00:00:00.000Z'),
  updatedAt: new Date('2026-06-30T00:00:00.000Z'),
};

interface MockResponse {
  response: Response<AuthErrorResponse>;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
}

function createRequest(authorization: string | undefined): Request {
  return {
    header(name: string) {
      if (name.toLowerCase() !== 'authorization') {
        return undefined;
      }

      return authorization;
    },
  } as Request;
}

function createResponse(): MockResponse {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();

  return {
    response: { status, json } as unknown as Response<AuthErrorResponse>,
    status,
    json,
  };
}

function createVerifier(
  verify: AuthVerifier['verify'] = vi.fn().mockResolvedValue(identity),
): AuthVerifier {
  return { verify };
}

function createAppUserRepository(
  upsertFromIdentity: AppUserRepository['upsertFromIdentity'] = vi.fn().mockResolvedValue(appUser),
): AppUserRepository {
  return { upsertFromIdentity };
}

async function runMiddleware(
  authVerifier: AuthVerifier,
  request: Request,
  appUserRepository?: AppUserRepository,
) {
  const middleware = createHttpAuthMiddleware(authVerifier, { appUserRepository });
  const response = createResponse();
  const next: NextFunction = vi.fn();

  await middleware(request, response.response, next);

  return { response, next };
}

describe('createHttpAuthMiddleware', () => {
  it('verifies the Bearer access token through AuthVerifier', async () => {
    const verify = vi.fn().mockResolvedValue(identity);
    const request = createRequest('Bearer valid-token');

    await runMiddleware(createVerifier(verify), request);

    expect(verify).toHaveBeenCalledWith({ bearerToken: 'valid-token' });
  });

  it('attaches the normalized identity for downstream handlers', async () => {
    const request = createRequest('Bearer valid-token');
    const { next } = await runMiddleware(createVerifier(), request);

    expect(next).toHaveBeenCalledOnce();
    expect(request).toHaveProperty('auth.identity', identity);
  });

  it('upserts and attaches the app user when a repository is injected', async () => {
    const upsertFromIdentity = vi.fn().mockResolvedValue(appUser);
    const request = createRequest('Bearer valid-token');
    const { next } = await runMiddleware(
      createVerifier(),
      request,
      createAppUserRepository(upsertFromIdentity),
    );

    expect(upsertFromIdentity).toHaveBeenCalledWith(identity);
    expect(next).toHaveBeenCalledOnce();
    expect(request).toHaveProperty('auth.identity', identity);
    expect(request).toHaveProperty('auth.user', appUser);
  });

  it('returns a stable 401 response for missing credentials', async () => {
    const verify = vi
      .fn()
      .mockRejectedValue(new AuthVerifyError('missing-credentials', 'Missing bearer token.'));
    const request = createRequest(undefined);

    const upsertFromIdentity = vi.fn();
    const { response, next } = await runMiddleware(
      createVerifier(verify),
      request,
      createAppUserRepository(upsertFromIdentity),
    );

    expect(verify).toHaveBeenCalledWith({ bearerToken: null });
    expect(upsertFromIdentity).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'auth/missing-credentials',
        message: 'Missing bearer token.',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns a stable 401 response for invalid credentials', async () => {
    const verify = vi
      .fn()
      .mockRejectedValue(new AuthVerifyError('invalid-credentials', 'Bearer token is invalid.'));
    const request = createRequest('Bearer invalid-token');
    const upsertFromIdentity = vi.fn();

    const { response, next } = await runMiddleware(
      createVerifier(verify),
      request,
      createAppUserRepository(upsertFromIdentity),
    );

    expect(upsertFromIdentity).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'auth/invalid-credentials',
        message: 'Bearer token is invalid.',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('passes unexpected verifier failures to Express error handling', async () => {
    const error = new Error('Verifier unavailable.');
    const request = createRequest('Bearer valid-token');

    const { response, next } = await runMiddleware(
      createVerifier(vi.fn().mockRejectedValue(error)),
      request,
    );

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
  });
});
