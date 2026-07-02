import './config/load-root-env.js';
import { createAppServer } from './app.js';
import { createRuntimeAuthDeps } from './auth/index.js';
import { createAutosaveManager } from './persistence/autosave.js';
import { prisma } from './persistence/prisma.js';
import { saveRoomElements } from './persistence/room-repository.js';
import { createRoomState } from './realtime/room-state.js';
import { createWhiteboardServer } from './realtime/whiteboard-server.js';
import type { SyncRoom } from './sync/index.js';

const PORT = process.env.PORT ?? 3001;

const roomState = createRoomState();
const authDeps = createRuntimeAuthDeps(prisma);
const syncRooms = new Map<string, SyncRoom>();
const { httpServer, io } = createAppServer({
  ...authDeps,
  db: prisma,
  syncRooms,
  roomElements: roomState.roomElements,
  roomClocks: roomState.roomClocks,
});

const autosave = createAutosaveManager({
  getRoomElements: (roomId) => {
    const elMap = roomState.roomElements.get(roomId);
    return elMap ? [...elMap.values()] : [];
  },
  getRoomClock: (roomId) => roomState.roomClocks.get(roomId) ?? 0,
  saveRoomElements: (roomId, elements, targetDocumentClock) =>
    saveRoomElements(prisma, roomId, elements, targetDocumentClock),
});

createWhiteboardServer(io, { ...roomState, autosave, ...authDeps, syncRooms });

httpServer.listen(PORT, () => console.log(`Server running on :${PORT}`));
