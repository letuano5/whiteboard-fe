import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AppUser, AppUserRepository } from './app-user-repository.js';
import { AuthVerifyError, type AuthVerifier, type VerifiedIdentity } from './types.js';

export interface AuthenticatedRequest extends Request {
  auth: {
    identity: VerifiedIdentity;
    user?: AppUser;
  };
}

export interface AuthErrorResponse {
  error: {
    code: 'auth/missing-credentials' | 'auth/invalid-credentials';
    message: string;
  };
}

export interface HttpAuthMiddlewareOptions {
  appUserRepository?: AppUserRepository;
}

export function createHttpAuthMiddleware(
  authVerifier: AuthVerifier,
  options: HttpAuthMiddlewareOptions = {},
): RequestHandler {
  return async (request: Request, response: Response<AuthErrorResponse>, next: NextFunction) => {
    try {
      const identity = await authVerifier.verify({
        bearerToken: readBearerToken(request),
      });
      const user = options.appUserRepository
        ? await options.appUserRepository.upsertFromIdentity(identity)
        : undefined;

      attachIdentity(request, identity, user);
      next();
    } catch (error) {
      if (error instanceof AuthVerifyError) {
        response.status(401).json({
          error: {
            code: `auth/${error.reason}`,
            message: error.message,
          },
        });
        return;
      }

      next(error);
    }
  };
}

function readBearerToken(request: Request): string | null {
  const headerValue = request.header('authorization');

  if (!headerValue) {
    return null;
  }

  const [scheme, token, extra] = headerValue.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer' || !token || extra) {
    return null;
  }

  return token;
}

function attachIdentity(
  request: Request,
  identity: VerifiedIdentity,
  user: AppUser | undefined,
): asserts request is AuthenticatedRequest {
  Object.assign(request, { auth: { identity, ...(user ? { user } : {}) } });
}
