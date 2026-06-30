import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

export function createAppServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: '*' } });

  return { app, httpServer, io };
}
