import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { PrismaClient } from '@prisma/client';
import type { AppUserRepository, AuthVerifier } from './auth/index.js';
import { createDocumentDashboardRouter } from './documents/document-dashboard.js';
import { createLocalBoardSaveRouter } from './rooms/local-board-save.js';
import { createNativeFileExportRouter } from './rooms/native-file-export.js';
import { createNativeFileImportRouter } from './rooms/native-file-import.js';
import { createRoomHistoryRouter } from './rooms/room-history.js';
import { createRoomSharingRouter } from './rooms/room-sharing.js';
import type { SyncRoom } from './sync/index.js';

export interface AppServerOptions {
  authVerifier?: AuthVerifier;
  appUserRepository?: AppUserRepository;
  db?: PrismaClient;
  syncRooms?: Map<string, SyncRoom>;
  roomElements?: Map<string, unknown>;
  roomClocks?: Map<string, number>;
}

export function createAppServer(options: AppServerOptions = {}) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);

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
      createNativeFileExportRouter({
        authVerifier: options.authVerifier,
        appUserRepository: options.appUserRepository,
        db: options.db,
        syncRooms: options.syncRooms,
      }),
    );
    app.use(
      createNativeFileImportRouter({
        authVerifier: options.authVerifier,
        appUserRepository: options.appUserRepository,
        db: options.db,
        ioServer: io,
        syncRooms: options.syncRooms,
        roomElements: options.roomElements,
        roomClocks: options.roomClocks,
      }),
    );
    app.use(
      createRoomHistoryRouter({
        authVerifier: options.authVerifier,
        appUserRepository: options.appUserRepository,
        db: options.db as never,
        ioServer: io,
        syncRooms: options.syncRooms,
        roomElements: options.roomElements,
        roomClocks: options.roomClocks,
      }),
    );
  }

  return { app, httpServer, io };
}
