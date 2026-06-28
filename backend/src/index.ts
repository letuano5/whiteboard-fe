import express from 'express';
import { createServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { WS_EVENTS } from '@vdt/shared';
import type { Element, Presence } from '@vdt/shared';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const PORT = process.env.PORT ?? 3001;

// Presence store: roomId → Map<socketId, Presence>
// socketId is the internal key for O(1) cleanup; sessionId is exposed to peers.
const roomPresence = new Map<string, Map<string, Presence>>();

// Element store: roomId → Map<elementId, Element> — in-memory authoritative-light (P2).
// Intentionally NOT cleared when room empties; data persists until server restart.
// Durable persistence added in P3A (PostgreSQL).
const roomElements = new Map<string, Map<string, Element>>();

declare module 'socket.io' {
  interface SocketData {
    sessionId: string;
    roomId: string;
  }
}

io.on('connection', (socket: Socket) => {
  console.log('client connected', socket.id);

  socket.on(
    WS_EVENTS.JOIN_ROOM,
    (payload: { roomId: string; sessionId: string; name: string; color: string }) => {
      const { roomId, sessionId, name, color } = payload;

      socket.join(roomId);
      socket.data.sessionId = sessionId;
      socket.data.roomId = roomId;

      // Register presence for this socket
      if (!roomPresence.has(roomId)) {
        roomPresence.set(roomId, new Map());
      }
      const roomMap = roomPresence.get(roomId)!;
      roomMap.set(socket.id, {
        sessionId,
        name,
        color,
        cursor: null,
        selectedIds: [],
        status: 'active',
      });

      console.log(`socket ${socket.id} (${name}) joined room ${roomId}`);

      // Send current room elements as a snapshot to the new joiner only
      const elements = roomElements.has(roomId)
        ? [...roomElements.get(roomId)!.values()]
        : [];
      socket.emit(WS_EVENTS.ROOM_SNAPSHOT, { elements });

      // Broadcast full presence list to the entire room (including the new joiner)
      const presences = [...roomMap.values()];
      io.to(roomId).emit(WS_EVENTS.USER_JOIN, { presences });
    },
  );

  socket.on(
    WS_EVENTS.ELEMENT_UPDATE,
    (payload: { roomId: string; elements: Element[]; sessionId?: string }) => {
      const { roomId, elements, sessionId } = payload;

      // Upsert into in-memory store (last-write-wins by element id)
      if (!roomElements.has(roomId)) {
        roomElements.set(roomId, new Map());
      }
      const elMap = roomElements.get(roomId)!;
      for (const el of elements) {
        elMap.set(el.id, el);
      }

      // Forward sessionId so peers can clear that peer's remoteDraft on commit
      socket.to(roomId).emit(WS_EVENTS.ELEMENT_UPDATE, { elements, sessionId });
    },
  );

  // Relay in-progress draft element state to peers without persisting it
  socket.on(
    WS_EVENTS.ELEMENT_DRAFT,
    (payload: { roomId: string; sessionId: string; elements: Element[] }) => {
      const { roomId, sessionId, elements } = payload;
      socket.to(roomId).emit(WS_EVENTS.ELEMENT_DRAFT, { sessionId, elements });
    },
  );

  // Relay cursor + viewport + selectedIds to the rest of the room — do NOT store it
  socket.on(
    WS_EVENTS.CURSOR_MOVE,
    (payload: {
      roomId: string;
      sessionId: string;
      cursor: { x: number; y: number } | null;
      viewport?: { x: number; y: number; zoom: number };
      selectedIds?: string[];
    }) => {
      const { roomId, sessionId, cursor, viewport, selectedIds } = payload;
      socket.to(roomId).emit(WS_EVENTS.CURSOR_MOVE, { sessionId, cursor, viewport, selectedIds });
    },
  );

  socket.on('disconnect', () => {
    const { sessionId, roomId } = socket.data;
    console.log(`client disconnected ${socket.id} (sessionId: ${sessionId})`);

    if (roomId && sessionId) {
      const roomMap = roomPresence.get(roomId);
      if (roomMap) {
        roomMap.delete(socket.id);
        if (roomMap.size === 0) {
          roomPresence.delete(roomId);
        }
      }
      io.to(roomId).emit(WS_EVENTS.USER_LEAVE, { sessionId });
    }
  });
});

httpServer.listen(PORT, () => console.log(`Server running on :${PORT}`));
