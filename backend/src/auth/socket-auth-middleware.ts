import type { Socket } from 'socket.io';
import type { AppUser, AppUserRepository } from './app-user-repository.js';
import { AuthVerifyError, type AuthVerifier, type VerifiedIdentity } from './types.js';

export interface AuthenticatedSocketData {
  identity: VerifiedIdentity;
  user?: AppUser;
}

export interface SocketAuthErrorData {
  code: 'auth/missing-credentials' | 'auth/invalid-credentials';
  message: string;
}

export interface SocketAuthError extends Error {
  data: SocketAuthErrorData;
}

type SocketMiddlewareNext = (error?: Error) => void;

export interface SocketAuthMiddlewareOptions {
  appUserRepository?: AppUserRepository;
  allowAnonymous?: boolean;
}

export function createSocketAuthMiddleware(
  authVerifier: AuthVerifier,
  options: SocketAuthMiddlewareOptions = {},
) {
  return async (socket: Socket, next: SocketMiddlewareNext): Promise<void> => {
    try {
      const bearerToken = readSocketAccessToken(socket);
      if (!bearerToken && options.allowAnonymous) {
        next();
        return;
      }

      const identity = await authVerifier.verify({
        bearerToken,
      });
      const user = options.appUserRepository
        ? await options.appUserRepository.upsertFromIdentity(identity)
        : undefined;

      attachIdentity(socket, identity, user);
      next();
    } catch (error) {
      if (error instanceof AuthVerifyError) {
        next(createSocketAuthError(error));
        return;
      }

      next(error instanceof Error ? error : new Error('Socket auth verification failed.'));
    }
  };
}

function readSocketAccessToken(socket: Socket): string | null {
  const handshakeToken = readHandshakeAuthToken(socket.handshake.auth);

  if (handshakeToken) {
    return handshakeToken;
  }

  return readAuthorizationHeader(socket.handshake.headers.authorization);
}

function readHandshakeAuthToken(authPayload: unknown): string | null {
  if (!isRecord(authPayload)) {
    return null;
  }

  const accessToken = authPayload.accessToken;

  return typeof accessToken === 'string' && accessToken.trim().length > 0
    ? accessToken.trim()
    : null;
}

function readAuthorizationHeader(headerValue: string | string[] | undefined): string | null {
  const authorization = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (!authorization) {
    return null;
  }

  const [scheme, token, extra] = authorization.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer' || !token || extra) {
    return null;
  }

  return token;
}

function attachIdentity(
  socket: Socket,
  identity: VerifiedIdentity,
  user: AppUser | undefined,
): void {
  socket.data.auth = { identity, ...(user ? { user } : {}) };
}

function createSocketAuthError(error: AuthVerifyError): SocketAuthError {
  const socketError = new Error(error.message) as SocketAuthError;
  socketError.data = {
    code: `auth/${error.reason}`,
    message: error.message,
  };

  return socketError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
