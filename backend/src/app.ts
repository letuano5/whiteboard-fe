import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { PrismaClient } from '@prisma/client';
import type { AppUserRepository, AuthVerifier } from './auth/index.js';
import { createDocumentDashboardRouter } from './documents/document-dashboard.js';
import { createLocalBoardSaveRouter } from './rooms/local-board-save.js';

export interface AppServerOptions {
  authVerifier?: AuthVerifier;
  appUserRepository?: AppUserRepository;
  db?: PrismaClient;
}

export function createAppServer(options: AppServerOptions = {}) {
  const app = express();
  if (options.authVerifier && options.appUserRepository && options.db) {
    app.use(
      createDocumentDashboardRouter({
        authVerifier: options.authVerifier,
        appUserRepository: options.appUserRepository,
        db: options.db,
      }),
    );
    app.use(
      createLocalBoardSaveRouter({
        authVerifier: options.authVerifier,
        appUserRepository: options.appUserRepository,
        db: options.db,
      }),
    );
  }
  const httpServer = createServer(app);
  const io = new Server(httpServer);

  return { app, httpServer, io };
}
