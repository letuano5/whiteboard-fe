import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { WS_EVENTS } from '@vdt/shared';
import type { Element, Presence } from '@vdt/shared';
import { prisma } from './persistence/prisma.js';
import {
  saveRoomElements,
  loadRoomElements,
  getRoomClock,
} from './persistence/room-repository.js';
import { createAutosaveManager } from './persistence/autosave.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const PORT = process.env.PORT ?? 3001;

// Presence store: roomId → Map<socketId, Presence>
// socketId is the internal key for O(1) cleanup; sessionId is exposed to peers.
const roomPresence = new Map<string, Map<string, Presence>>();

// Element store: roomId → Map<elementId, Element> — in-memory authoritative hot path (P2/P3A).
// Intentionally NOT cleared when room empties; data persists until server restart.
// Durable persistence added in P3A (PostgreSQL).
const roomElements = new Map<string, Map<string, Element>>();

// Autosave manager — batches dirty room flushes with a 5-second default delay.
const autosave = createAutosaveManager({
  getRoomElements: (roomId) => {
    const elMap = roomElements.get(roomId);
    return elMap ? [...elMap.values()] : [];
  },
  saveRoomElements: (roomId, elements) => saveRoomElements(prisma, roomId, elements),
});

declare module 'socket.io' {
  interface SocketData {
    sessionId: string;
    roomId: string;
  }
}

/**
 * Creates and wires up the Socket.IO whiteboard server on the given `Server`
 * instance. This function is exported to allow injection of custom state maps
 * and autosave instances in tests (T014 test seam — FR-011).
 */
export function createWhiteboardServer(
  ioServer: Server,
  deps: {
    roomPresence: Map<string, Map<string, Presence>>;
    roomElements: Map<string, Map<string, Element>>;
    autosave: ReturnType<typeof createAutosaveManager>;
    db?: typeof prisma;
  },
): void {
  const {
    roomPresence: presence,
    roomElements: elements,
    autosave: save,
    db = prisma,
  } = deps;

  ioServer.on('connection', (socket: Socket) => {
    console.log('client connected', socket.id);

    socket.on(
      WS_EVENTS.JOIN_ROOM,
      async (payload: { roomId: string; sessionId: string; name: string; color: string }) => {
        const { roomId, sessionId, name, color } = payload;

        socket.join(roomId);
        socket.data.sessionId = sessionId;
        socket.data.roomId = roomId;

        // Register presence for this socket
        if (!presence.has(roomId)) {
          presence.set(roomId, new Map());
        }
        const roomMap = presence.get(roomId)!;
        roomMap.set(socket.id, {
          sessionId,
          name,
          color,
          cursor: null,
          selectedIds: [],
          status: 'active',
        });

        console.log(`socket ${socket.id} (${name}) joined room ${roomId}`);

        // Load room elements from DB (cold path) or use in-memory state (warm path)
        let documentClock = 0;
        try {
          const roomMap = elements.get(roomId);
          if (!roomMap || roomMap.size === 0) {
            // Cold path: room absent or empty in memory — load from DB
            const loaded = await loadRoomElements(db, roomId);
            if (!elements.has(roomId)) elements.set(roomId, new Map());
            for (const el of loaded.elements) elements.get(roomId)!.set(el.id, el);
            documentClock = loaded.documentClock;
          } else {
            // Warm path: elements already in memory — only fetch clock from DB
            documentClock = await getRoomClock(db, roomId);
          }
        } catch (err) {
          console.error('[load-room] DB error during join:', err);
          documentClock = 0;
        }

        // Send current room elements as a snapshot to the new joiner only
        const snapshot = elements.has(roomId) ? [...elements.get(roomId)!.values()] : [];
        socket.emit(WS_EVENTS.ROOM_SNAPSHOT, { elements: snapshot, documentClock });

        // Broadcast full presence list to the entire room (including the new joiner)
        const presences = [...roomMap.values()];
        ioServer.to(roomId).emit(WS_EVENTS.USER_JOIN, { presences });
      },
    );

    socket.on(
      WS_EVENTS.ELEMENT_UPDATE,
      (payload: { roomId: string; elements: Element[]; sessionId?: string }) => {
        const { roomId, elements: incoming, sessionId } = payload;

        // FR-002: Update in-memory hot path first (last-write-wins by element id)
        if (!elements.has(roomId)) {
          elements.set(roomId, new Map());
        }
        const elMap = elements.get(roomId)!;
        for (const el of incoming) {
          elMap.set(el.id, el);
        }

        // FR-008: Schedule autosave — must not block the broadcast below (AC-8)
        save.markDirty(roomId);

        // Broadcast to peers — runs synchronously after in-memory update (AC-8)
        socket.to(roomId).emit(WS_EVENTS.ELEMENT_UPDATE, { elements: incoming, sessionId });
      },
    );

    // Relay in-progress draft element state to peers without persisting it
    socket.on(
      WS_EVENTS.ELEMENT_DRAFT,
      (payload: { roomId: string; sessionId: string; elements: Element[] }) => {
        const { roomId, sessionId, elements: draftElements } = payload;
        socket.to(roomId).emit(WS_EVENTS.ELEMENT_DRAFT, { sessionId, elements: draftElements });
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
        const roomMap = presence.get(roomId);
        if (roomMap) {
          roomMap.delete(socket.id);
          if (roomMap.size === 0) {
            // FR-009: Last client left — flush immediately (AC-7)
            presence.delete(roomId);
            save.flushRoomNow(roomId).catch((err: unknown) => {
              console.error(`[autosave] flushRoomNow failed for room ${roomId}:`, err);
            });
          }
        }
        ioServer.to(roomId).emit(WS_EVENTS.USER_LEAVE, { sessionId });
      }
    });
  });
}

// Wire the default production instances (skip when imported by test runner)
if (!process.env.VITEST) {
  createWhiteboardServer(io, { roomPresence, roomElements, autosave });
  httpServer.listen(PORT, () => console.log(`Server running on :${PORT}`));
}
