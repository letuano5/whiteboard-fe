import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { PrismaClient } from '@prisma/client';
import type { AppUserRepository, AuthVerifier } from './auth/index.js';
import { createDocumentDashboardRouter } from './documents/document-dashboard.js';
import { createLocalBoardSaveRouter } from './rooms/local-board-save.js';
import { createNativeFileImportRouter } from './rooms/native-file-import.js';
import { createRoomSharingRouter } from './rooms/room-sharing.js';

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
    app.use(
      createRoomSharingRouter({
        authVerifier: options.authVerifier,
        appUserRepository: options.appUserRepository,
        db: options.db,
      }),
    );
    app.use(
      createNativeFileImportRouter({
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
