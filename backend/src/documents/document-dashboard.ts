import type { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { AuthVerifier } from '../auth/index.js';
import {
  createHttpAuthMiddleware,
  type AppUserRepository,
  type AuthenticatedRequest,
} from '../auth/index.js';
import {
  createDashboardDocument,
  deleteDashboardDocument,
  DocumentPermissionError,
  listDashboardDocuments,
  recordDocumentOpen,
  updateDashboardDocument,
} from './document-service.js';
import type {
  DashboardDocument,
  DashboardListFilters,
  DocumentDashboardResponse,
  DocumentErrorResponse,
} from './types.js';

interface DocumentDashboardDeps {
  authVerifier: AuthVerifier;
  appUserRepository: AppUserRepository;
  db: PrismaClient;
}

export function createDocumentDashboardRouter(deps: DocumentDashboardDeps): Router {
  const router = express.Router();
  router.use(express.json({ limit: '1mb' }));
  router.use(
    createHttpAuthMiddleware(deps.authVerifier, {
      appUserRepository: deps.appUserRepository,
    }),
  );

  router.get(
    '/api/documents',
    asyncRoute((request, response: Response<DocumentDashboardResponse | DocumentErrorResponse>) =>
      handleListDocuments(request as AuthenticatedRequest, response, deps),
    ),
  );
  router.post(
    '/api/documents',
    asyncRoute((request, response: Response<{ roomId: string } | DocumentErrorResponse>) =>
      handleCreateDocument(request as AuthenticatedRequest, response, deps),
    ),
  );
  router.post(
    '/api/documents/:roomId/open',
    asyncRoute((request, response: Response<{ ok: true } | DocumentErrorResponse>) =>
      handleOpenDocument(request as AuthenticatedRequest, response, deps),
    ),
  );
  router.patch(
    '/api/documents/:roomId',
    asyncRoute((request, response: Response<DashboardDocument | DocumentErrorResponse>) =>
      handleUpdateDocument(request as AuthenticatedRequest, response, deps),
    ),
  );
  router.delete(
    '/api/documents/:roomId',
    asyncRoute((request, response: Response<{ ok: true } | DocumentErrorResponse>) =>
      handleDeleteDocument(request as AuthenticatedRequest, response, deps),
    ),
  );

  return router;
}

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    handler(request, response).catch(next);
  };
}

async function handleListDocuments(
  request: AuthenticatedRequest,
  response: Response<DocumentDashboardResponse | DocumentErrorResponse>,
  deps: DocumentDashboardDeps,
): Promise<void> {
  const user = request.auth.user;
  if (!user) {
    sendDocumentError(response, 401, 'documents/unauthenticated', 'Authentication is required.');
    return;
  }

  response.json(await listDashboardDocuments(deps.db, user.id, readListFilters(request)));
}

async function handleCreateDocument(
  request: AuthenticatedRequest,
  response: Response<{ roomId: string } | DocumentErrorResponse>,
  deps: DocumentDashboardDeps,
): Promise<void> {
  const user = request.auth.user;
  if (!user) {
    sendDocumentError(response, 401, 'documents/unauthenticated', 'Authentication is required.');
    return;
  }

  const name = readOptionalName(request.body);
  if (name === false) {
    sendDocumentError(response, 400, 'documents/invalid-payload', 'Document name is invalid.');
    return;
  }

  response.status(201).json(await createDashboardDocument(deps.db, user.id, name ?? undefined));
}

async function handleOpenDocument(
  request: AuthenticatedRequest,
  response: Response<{ ok: true } | DocumentErrorResponse>,
  deps: DocumentDashboardDeps,
): Promise<void> {
  const user = request.auth.user;
  if (!user) {
    sendDocumentError(response, 401, 'documents/unauthenticated', 'Authentication is required.');
    return;
  }

  const roomId = readRoomId(request);
  if (!roomId) {
    sendDocumentError(response, 400, 'documents/invalid-payload', 'Document id is invalid.');
    return;
  }

  try {
    await recordDocumentOpen(deps.db, user.id, roomId);
    response.json({ ok: true });
  } catch (error) {
    sendKnownDocumentError(response, error);
  }
}

async function handleUpdateDocument(
  request: AuthenticatedRequest,
  response: Response<DashboardDocument | DocumentErrorResponse>,
  deps: DocumentDashboardDeps,
): Promise<void> {
  const user = request.auth.user;
  if (!user) {
    sendDocumentError(response, 401, 'documents/unauthenticated', 'Authentication is required.');
    return;
  }

  const input = readUpdateInput(request.body);
  if (!input) {
    sendDocumentError(response, 400, 'documents/invalid-payload', 'Document update is invalid.');
    return;
  }

  const roomId = readRoomId(request);
  if (!roomId) {
    sendDocumentError(response, 400, 'documents/invalid-payload', 'Document id is invalid.');
    return;
  }

  try {
    response.json(await updateDashboardDocument(deps.db, user.id, roomId, input));
  } catch (error) {
    sendKnownDocumentError(response, error);
  }
}

async function handleDeleteDocument(
  request: AuthenticatedRequest,
  response: Response<{ ok: true } | DocumentErrorResponse>,
  deps: DocumentDashboardDeps,
): Promise<void> {
  const user = request.auth.user;
  if (!user) {
    sendDocumentError(response, 401, 'documents/unauthenticated', 'Authentication is required.');
    return;
  }

  const roomId = readRoomId(request);
  if (!roomId) {
    sendDocumentError(response, 400, 'documents/invalid-payload', 'Document id is invalid.');
    return;
  }

  try {
    await deleteDashboardDocument(deps.db, user.id, roomId);
    response.json({ ok: true });
  } catch (error) {
    sendKnownDocumentError(response, error);
  }
}

function readListFilters(request: Request): DashboardListFilters {
  const query = request.query;
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const scope =
    query.scope === 'owned' || query.scope === 'shared' || query.scope === 'all'
      ? query.scope
      : undefined;
  const cursor = typeof query.cursor === 'string' ? query.cursor : undefined;
  const limit = typeof query.limit === 'string' ? Number.parseInt(query.limit, 10) : undefined;

  return {
    ...(search ? { search } : {}),
    ...(scope ? { scope } : {}),
    ...(cursor ? { cursor } : {}),
    ...(Number.isFinite(limit) ? { limit } : {}),
  };
}

function readOptionalName(value: unknown): string | null | false {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  if (body.name === undefined || body.name === null) return null;
  return typeof body.name === 'string' ? body.name : false;
}

function readUpdateInput(value: unknown): { name?: string; archived?: boolean } | null {
  if (typeof value !== 'object' || value === null) return null;
  const body = value as Record<string, unknown>;
  const input: { name?: string; archived?: boolean } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string') return null;
    input.name = body.name;
  }

  if (body.archived !== undefined) {
    if (typeof body.archived !== 'boolean') return null;
    input.archived = body.archived;
  }

  return Object.keys(input).length > 0 ? input : null;
}

function readRoomId(request: Request): string | null {
  const roomId = request.params.roomId;
  return typeof roomId === 'string' && roomId ? roomId : null;
}

function sendKnownDocumentError(response: Response<DocumentErrorResponse>, error: unknown): void {
  if (error instanceof DocumentPermissionError) {
    sendDocumentError(
      response,
      error.code === 'documents/not-found' ? 404 : 403,
      error.code,
      error.message,
    );
    return;
  }

  throw error;
}

function sendDocumentError(
  response: Response<DocumentErrorResponse>,
  status: number,
  code: DocumentErrorResponse['error']['code'],
  message: string,
): void {
  response.status(status).json({ error: { code, message } });
}
