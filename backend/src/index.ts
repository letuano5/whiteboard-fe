import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { WS_EVENTS } from '@vdt/shared';
import type { Element } from '@vdt/shared';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const PORT = process.env.PORT ?? 3001;

io.on('connection', (socket) => {
  console.log('client connected', socket.id);

  socket.on(WS_EVENTS.JOIN_ROOM, (payload: { roomId: string }) => {
    const { roomId } = payload;
    socket.join(roomId);
    console.log(`socket ${socket.id} joined room ${roomId}`);
  });

  socket.on(
    WS_EVENTS.ELEMENT_UPDATE,
    (payload: { roomId: string; elements: Element[] }) => {
      const { roomId, elements } = payload;
      socket.to(roomId).emit(WS_EVENTS.ELEMENT_UPDATE, { elements });
    },
  );

  socket.on('disconnect', () => console.log('client disconnected', socket.id));
});

httpServer.listen(PORT, () => console.log(`Server running on :${PORT}`));
