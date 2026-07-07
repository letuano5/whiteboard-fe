import './config/load-root-env.js';
import { createAppServer } from './app.js';
import { createRuntimeAuthDeps } from './auth/index.js';
import { prisma } from './persistence/prisma.js';
import { startHotRoomGc } from './realtime/room-cache-gc.js';
import { createRoomState } from './realtime/room-state.js';
import { createWhiteboardServer } from './realtime/whiteboard-server.js';
import type { SyncRoom } from './sync/index.js';
import { startProcessedRequestGc } from './sync/sync-room-processed-request-gc.js';
import { startTombstoneGc } from './sync/sync-room-tombstone-gc.js';

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

createWhiteboardServer(io, { ...roomState, ...authDeps, syncRooms });
startProcessedRequestGc(prisma);
startTombstoneGc(prisma);
startHotRoomGc({ ...roomState, syncRooms });

httpServer.listen(PORT, () => console.log(`Server running on :${PORT}`));
