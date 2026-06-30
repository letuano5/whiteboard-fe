import type { Socket } from 'socket.io';
import { describe, expect, it, vi } from 'vitest';
import { createAutosaveManager } from '../persistence/autosave.js';
import { createWhiteboardServer } from '../realtime/whiteboard-server.js';
import { makeFakeIo } from '../test/fake-socket-io.js';
import {
  AuthVerifyError,
  createSocketAuthMiddleware,
  type AppUser,
  type AppUserRepository,
  type AuthVerifier,
  type SocketAuthError,
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

function createSocket(options: { auth?: unknown; authorization?: string | string[] }): Socket {
  return {
    data: {},
    handshake: {
      auth: options.auth,
      headers: {
        authorization: options.authorization,
      },
    },
  } as unknown as Socket;
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
  socket: Socket,
  appUserRepository?: AppUserRepository,
) {
  const middleware = createSocketAuthMiddleware(authVerifier, { appUserRepository });
  const next = vi.fn();

  await middleware(socket, next);

  return { next };
}

describe('createSocketAuthMiddleware', () => {
  it('verifies the handshake access token through AuthVerifier', async () => {
    const verify = vi.fn().mockResolvedValue(identity);
    const socket = createSocket({ auth: { accessToken: 'valid-token' } });

    await runMiddleware(createVerifier(verify), socket);

    expect(verify).toHaveBeenCalledWith({ bearerToken: 'valid-token' });
  });

  it('falls back to the Authorization header when handshake auth has no access token', async () => {
    const verify = vi.fn().mockResolvedValue(identity);
    const socket = createSocket({ authorization: 'Bearer header-token' });

    await runMiddleware(createVerifier(verify), socket);

    expect(verify).toHaveBeenCalledWith({ bearerToken: 'header-token' });
  });

  it('attaches the normalized identity for socket handlers', async () => {
    const socket = createSocket({ auth: { accessToken: 'valid-token' } });
    const { next } = await runMiddleware(createVerifier(), socket);

    expect(next).toHaveBeenCalledOnce();
    expect(socket.data.auth?.identity).toEqual(identity);
  });

  it('upserts and attaches the app user when a repository is injected', async () => {
    const upsertFromIdentity = vi.fn().mockResolvedValue(appUser);
    const socket = createSocket({ auth: { accessToken: 'valid-token' } });
    const { next } = await runMiddleware(
      createVerifier(),
      socket,
      createAppUserRepository(upsertFromIdentity),
    );

    expect(upsertFromIdentity).toHaveBeenCalledWith(identity);
    expect(next).toHaveBeenCalledOnce();
    expect(socket.data.auth).toEqual({ identity, user: appUser });
  });

  it('rejects missing credentials with a stable auth error code', async () => {
    const verify = vi
      .fn()
      .mockRejectedValue(new AuthVerifyError('missing-credentials', 'Missing bearer token.'));
    const socket = createSocket({});
    const upsertFromIdentity = vi.fn();

    const { next } = await runMiddleware(
      createVerifier(verify),
      socket,
      createAppUserRepository(upsertFromIdentity),
    );
    const error = next.mock.calls[0]?.[0] as SocketAuthError;

    expect(verify).toHaveBeenCalledWith({ bearerToken: null });
    expect(upsertFromIdentity).not.toHaveBeenCalled();
    expect(error).toBeInstanceOf(Error);
    expect(error.data).toEqual({
      code: 'auth/missing-credentials',
      message: 'Missing bearer token.',
    });
    expect(socket.data.auth).toBeUndefined();
  });

  it('rejects invalid credentials with a stable auth error code', async () => {
    const verify = vi
      .fn()
      .mockRejectedValue(new AuthVerifyError('invalid-credentials', 'Bearer token is invalid.'));
    const socket = createSocket({ auth: { accessToken: 'invalid-token' } });
    const upsertFromIdentity = vi.fn();

    const { next } = await runMiddleware(
      createVerifier(verify),
      socket,
      createAppUserRepository(upsertFromIdentity),
    );
    const error = next.mock.calls[0]?.[0] as SocketAuthError;

    expect(upsertFromIdentity).not.toHaveBeenCalled();
    expect(error.data).toEqual({
      code: 'auth/invalid-credentials',
      message: 'Bearer token is invalid.',
    });
    expect(socket.data.auth).toBeUndefined();
  });

  it('passes unexpected verifier failures to Socket.IO error handling', async () => {
    const error = new Error('Verifier unavailable.');
    const socket = createSocket({ auth: { accessToken: 'valid-token' } });

    const { next } = await runMiddleware(createVerifier(vi.fn().mockRejectedValue(error)), socket);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('createWhiteboardServer socket auth wiring', () => {
  it('installs socket auth only when an AuthVerifier is provided', () => {
    const { ioServer } = makeFakeIo();
    const autosave = createAutosaveManager({
      delayMs: 60000,
      getRoomElements: () => [],
      saveRoomElements: vi.fn().mockResolvedValue(null),
    });

    createWhiteboardServer(ioServer as unknown as Parameters<typeof createWhiteboardServer>[0], {
      roomPresence: new Map(),
      roomElements: new Map(),
      autosave,
      authVerifier: createVerifier(),
    });

    expect(ioServer.use).toHaveBeenCalledTimes(1);
  });

  it('keeps socket auth disabled when no AuthVerifier is provided', () => {
    const { ioServer } = makeFakeIo();
    const autosave = createAutosaveManager({
      delayMs: 60000,
      getRoomElements: () => [],
      saveRoomElements: vi.fn().mockResolvedValue(null),
    });

    createWhiteboardServer(ioServer as unknown as Parameters<typeof createWhiteboardServer>[0], {
      roomPresence: new Map(),
      roomElements: new Map(),
      autosave,
    });

    expect(ioServer.use).not.toHaveBeenCalled();
  });
});
